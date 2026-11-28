import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { test, expect } from "@playwright/test";
import { NextRequest } from "next/server";
import { proxy } from "../../src/proxy";

/**
 * The proxy against a stand-in Supabase that stalls, fails or answers late.
 * It calls the proxy directly, so no app server or real Supabase is involved.
 */

type Handler = (url: string, res: ServerResponse) => void;

let server: Server;
let handler: Handler;
let realUrl: string | undefined;

test.beforeAll(async () => {
  server = createServer((req, res) => handler(req.url ?? "", res));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  realUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = realUrl;
  server.closeAllConnections();
  server.close();
});

const now = () => Math.floor(Date.now() / 1000);
const USER = { id: "00000000-0000-0000-0000-000000000001", aud: "authenticated" };

const session = (expiresAt: number, refreshToken: string) => ({
  access_token: "header.payload.signature",
  refresh_token: refreshToken,
  expires_at: expiresAt,
  expires_in: 3600,
  token_type: "bearer",
  user: USER,
});

function request(path: string, expiresAt: number) {
  const value =
    "base64-" + Buffer.from(JSON.stringify(session(expiresAt, "old-token"))).toString("base64url");
  return new NextRequest(`http://localhost:3100${path}`, {
    headers: { cookie: `sb-127-auth-token=${value}` },
  });
}

const reply = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

/** Answers with a gateway timeout, but only after the proxy should have given up. */
const stall: Handler = (_url, res) => {
  setTimeout(() => reply(res, 504, { message: "timeout" }), 6000).unref();
};

async function run(path: string, expiresAt: number) {
  const warnings: string[] = [];
  const { warn, error } = console;
  console.warn = (...args: unknown[]) => void warnings.push(args.join(" "));
  console.error = () => {}; // auth-js logs every failed request
  const started = Date.now();
  try {
    const response = await proxy(request(path, expiresAt));
    return { response, ms: Date.now() - started, warnings };
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

function expectPassThrough(response: Response, label: string) {
  expect(response.headers.get("location"), `${label}: no redirect`).toBeNull();
  expect(response.headers.get("x-middleware-next"), `${label}: passed through`).toBe("1");
}

for (const [name, expiresIn] of [["an expired", -60], ["a current", 3000]] as const) {
  for (const path of ["/", "/dashboard", "/login"]) {
    test(`stalled Supabase, ${name} session, ${path}: gives up after 3s`, async () => {
      handler = stall;
      const { response, ms, warnings } = await run(path, now() + expiresIn);

      expect(ms).toBeGreaterThanOrEqual(2900);
      expect(ms).toBeLessThan(4000);
      expectPassThrough(response, path);
      expect(response.headers.get("set-cookie"), "the session is left alone").toBeNull();
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("[auth]");
      expect(warnings[0]).not.toMatch(/old-token|header\.payload|00000000-/);
    });
  }
}

const failures: [string, Handler][] = [
  ["answers 503", (_url, res) => reply(res, 503, { message: "unavailable" })],
  ["answers 500", (_url, res) => reply(res, 500, { message: "boom" })],
  ["drops the connection", (_url, res) => res.destroy()],
  ["rate limits", (_url, res) => reply(res, 429, { message: "slow down" })],
];

for (const [name, failure] of failures) {
  test(`Supabase ${name}: not treated as signed out`, async () => {
    handler = failure;
    const { response } = await run("/dashboard", now() + 3000);
    expectPassThrough(response, name);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
}

test("a rejected token still redirects /dashboard to /login", async () => {
  handler = (_url, res) => reply(res, 403, { error_code: "bad_jwt", msg: "invalid JWT" });
  const { response } = await run("/dashboard", now() + 3000);
  expect(response.headers.get("location")).toContain("/login?redirectedFrom=%2Fdashboard");
});

test("cookies saved before the deadline are kept", async () => {
  handler = (url, res) => {
    if (url.startsWith("/auth/v1/token")) return reply(res, 200, session(now() + 3600, "new-token"));
    stall(url, res); // the follow-up user lookup never answers in time
  };
  const { response, ms } = await run("/dashboard", now() - 60);

  expect(ms).toBeLessThan(4000);
  expectPassThrough(response, "/dashboard");
  const cookie = response.cookies.getAll().find((c) => c.name === "sb-127-auth-token");
  const saved = Buffer.from(cookie!.value.replace(/^base64-/, ""), "base64url").toString();
  expect(saved).toContain("new-token");
  expect(response.headers.get("cache-control")).toContain("no-store");
});

test("a refresh that finishes after the deadline writes nothing", async () => {
  handler = (url, res) => {
    if (!url.startsWith("/auth/v1/token")) return reply(res, 200, USER);
    setTimeout(() => reply(res, 200, session(now() + 3600, "late-token")), 4000).unref();
  };
  const { response, ms } = await run("/", now() - 60);
  expect(ms).toBeLessThan(3900);

  await new Promise((resolve) => setTimeout(resolve, 2500));
  expect(response.headers.get("set-cookie")).toBeNull();
});
