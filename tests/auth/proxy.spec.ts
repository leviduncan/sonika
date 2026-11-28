import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
// Next 16.2 still exports this under its pre-rename name.
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "../../src/proxy";

/**
 * Proxy checks: matcher coverage, route gating, and session cookie handling.
 *
 * The first two groups need nothing but the app. The last group signs in
 * throwaway users and only runs when .env.local points at a LOCAL Supabase
 * (`supabase start`); it deletes what it creates.
 */

loadEnvConfig(process.cwd());
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const LOCAL_SUPABASE =
  /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(SUPABASE_URL) && !!SERVICE_KEY;

const LOGIN_FROM_DASHBOARD = /\/login\?redirectedFrom=%2Fdashboard$/;

// ── Matcher ─────────────────────────────────────────────────────────────────

const matches = (url: string) => unstable_doesMiddlewareMatch({ config, nextConfig: {}, url });

test("proxy runs on pages, including ones that only look like assets", () => {
  for (const url of [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/confirm?token_hash=x&type=recovery&next=/reset-password",
    "/dashboard",
    "/dashboard/billing",
    "/dashboard/clients/abc",
    "/dashboard/anything.png",
    "/dashboard/fonts/x.woff2",
    "/apiary",
    "/icon.svg-notes",
  ]) {
    expect(matches(url), url).toBe(true);
  }
});

test("proxy skips API routes, build output and public images and fonts", () => {
  for (const url of [
    "/api/webhooks/stripe",
    "/api/webhooks/vapi",
    "/_next/static/chunks/main.js",
    "/_next/image?url=%2Fa.png&w=64&q=75",
    "/fonts/Switzer-Variable.woff2",
    "/favicon.ico",
    "/icon.svg",
    "/opengraph-image",
    "/twitter-image",
  ]) {
    expect(matches(url), url).toBe(false);
  }
});

// ── Signed out ──────────────────────────────────────────────────────────────

test("signed out: the proxy redirects /dashboard paths to /login", async ({ request }) => {
  const res = await request.get("/dashboard", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  // `redirectedFrom` is set only by the proxy, not by requireProfile().
  expect(res.headers().location).toMatch(LOGIN_FROM_DASHBOARD);

  const assetLike = await request.get("/dashboard/anything.png", { maxRedirects: 0 });
  expect(assetLike.status()).toBe(307);
});

test("signed out: paths that only start like /dashboard are not protected", async ({
  request,
}) => {
  for (const url of ["/dashboardx", "/dashboard-old", "/dashboards/1"]) {
    const res = await request.get(url, { maxRedirects: 0 });
    expect(res.status(), url).toBe(404);
  }

  const below = await request.get("/dashboard/missing", { maxRedirects: 0 });
  expect(below.status()).toBe(307);
});

test("signed out: public and auth pages are served, not redirected", async ({ request }) => {
  for (const url of [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth/confirm?token_hash=x&type=recovery&next=/reset-password",
    "/fonts/Switzer-Variable.woff2",
    "/icon.svg",
  ]) {
    const res = await request.get(url, { maxRedirects: 0 });
    expect(res.status(), url).toBe(200);
  }
});

// ── Sessions (local Supabase only) ──────────────────────────────────────────

test.describe("with a signed-in user", () => {
  test.skip(!LOCAL_SUPABASE, "Needs .env.local pointing at a local Supabase (supabase start).");

  const admin = () =>
    createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  let user: { id: string; email: string; password: string };

  test.beforeEach(async () => {
    const email = `proxy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const password = "Original-pass-123";
    const { data, error } = await admin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { agency_name: "Proxy Test Agency", full_name: "Proxy Test" },
    });
    if (error) throw error;
    user = { id: data.user.id, email, password };
  });

  test.afterEach(async () => {
    const db = admin();
    const { data: profile } = await db
      .from("profiles")
      .select("agency_id")
      .eq("id", user.id)
      .maybeSingle();
    await db.auth.admin.deleteUser(user.id);
    if (profile?.agency_id) await db.from("agencies").delete().eq("id", profile.agency_id);
  });

  async function fillLogin(page: Page) {
    await page.getByLabel("Work email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: /Sign in/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  }

  async function signIn(page: Page) {
    await page.goto("/login");
    await fillLogin(page);
  }

  // The session cookie is `base64-<json>`, split into `.0`, `.1`… when long.
  const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

  const authCookies = async (context: BrowserContext) =>
    (await context.cookies())
      .filter((c) => AUTH_COOKIE.test(c.name))
      .sort((a, b) => a.name.localeCompare(b.name));

  type Session = { expires_at: number; refresh_token: string };

  async function readSession(context: BrowserContext): Promise<Session> {
    const raw = (await authCookies(context)).map((c) => c.value).join("");
    return JSON.parse(Buffer.from(raw.replace(/^base64-/, ""), "base64url").toString());
  }

  /** Rewrites the stored session so the next server request has to refresh it. */
  async function expireSession(context: BrowserContext, changes: Partial<Session> = {}) {
    const cookies = await authCookies(context);
    const session = {
      ...(await readSession(context)),
      expires_at: Math.floor(Date.now() / 1000) - 60,
      ...changes,
    };
    let rest = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
    const rewritten = cookies.map((cookie, i) => {
      const length = i === cookies.length - 1 ? rest.length : cookie.value.length;
      const value = rest.slice(0, length);
      rest = rest.slice(length);
      return { ...cookie, value };
    });
    await context.addCookies(rewritten);
    return session;
  }

  const now = () => Math.floor(Date.now() / 1000);

  test("a refresh needed during a page render is saved", async ({ page, context }) => {
    await signIn(page);
    const before = await expireSession(context);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();

    const after = await readSession(context);
    expect(after.expires_at).toBeGreaterThan(now());
    expect(after.refresh_token).not.toBe(before.refresh_token);
  });

  for (const path of ["/", "/dashboard"]) {
    test(`a response that refreshes the session on ${path} is not cacheable`, async ({
      page,
      context,
    }) => {
      await signIn(page);
      await expireSession(context);

      const res = await context.request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(200);
      expect(res.headers()["set-cookie"]).toContain("-auth-token");
      expect(res.headers()["cache-control"]).toContain("no-store");
    });
  }

  test("signed in: /login and /signup redirect to /dashboard", async ({ page, context }) => {
    await signIn(page);
    for (const path of ["/login", "/signup"]) {
      const res = await context.request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(307);
      expect(res.headers().location, path).toMatch(/\/dashboard$/);
    }
  });

  test("signed in: paths that only start like /login or /signup are left alone", async ({
    page,
    context,
  }) => {
    await signIn(page);
    for (const path of ["/login-help", "/loginx", "/signup-info"]) {
      const res = await context.request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(404);
    }

    const below = await context.request.get("/login/missing", { maxRedirects: 0 });
    expect(below.status()).toBe(307);
  });

  test("the redirect off /login keeps the refreshed session", async ({ page, context }) => {
    await signIn(page);
    const before = await expireSession(context);

    const res = await context.request.get("/login", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["set-cookie"]).toContain("-auth-token");
    expect(res.headers()["cache-control"]).toContain("no-store");

    const after = await readSession(context);
    expect(after.expires_at).toBeGreaterThan(now());
    expect(after.refresh_token).not.toBe(before.refresh_token);
  });

  test("the redirect to /login clears a dead session", async ({ page, context }) => {
    await signIn(page);
    await expireSession(context, { refresh_token: "revoked-token" });

    const res = await context.request.get("/dashboard", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toMatch(LOGIN_FROM_DASHBOARD);
    expect(await authCookies(context)).toHaveLength(0);
  });

  test("a signed-in user can still use a reset link", async ({ page }) => {
    await signIn(page);
    const { data, error } = await admin().auth.admin.generateLink({
      type: "recovery",
      email: user.email,
    });
    if (error) throw error;

    await page.goto(
      `/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/reset-password`,
    );
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();
  });

  // Server Actions are POSTs to the page's own path, so the proxy sees them too.
  // When one redirects, Next copies the target page's headers onto its response,
  // so /login must never be marked as publicly cacheable.

  /** Runs `act` and returns the headers of the Server Action response it causes. */
  async function actionHeaders(page: Page, act: () => Promise<void>) {
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.request().headers()["next-action"] !== undefined),
      act(),
    ]);
    return response.allHeaders();
  }

  for (const expired of [false, true]) {
    test(`the sign-out response is not cacheable (${expired ? "expired" : "current"} session)`, async ({
      page,
      context,
    }) => {
      await signIn(page);
      // Wait out the link prefetches, so none refreshes the session mid-test.
      await page.goto("/dashboard", { waitUntil: "networkidle" });
      if (expired) await expireSession(context);

      const headers = await actionHeaders(page, () =>
        page.getByRole("button", { name: /Sign out/ }).click(),
      );
      expect(headers["set-cookie"]).toContain("-auth-token");
      expect(headers["cache-control"]).toContain("no-store");
      expect(headers["cache-control"]).not.toMatch(/s-maxage|public/);
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  test("an action that sends a lost session to /login is not cacheable", async ({
    page,
    context,
  }) => {
    await signIn(page);
    await page.getByRole("button", { name: /Add client/ }).click();
    await page.getByLabel("Client name").fill("Bayside Dental");
    await context.clearCookies();

    const headers = await actionHeaders(page, () =>
      page.getByRole("button", { name: /Create/ }).click(),
    );
    expect(headers["cache-control"]).toContain("no-store");
    expect(headers["cache-control"]).not.toMatch(/s-maxage|public/);
  });

  test("Sign out with a lost session lands on /login", async ({ page, context }) => {
    await signIn(page);
    await context.clearCookies();

    await page.getByRole("button", { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /Sign in/ })).toBeVisible();
  });

  test("Add client with a lost session lands on /login", async ({ page, context }) => {
    await signIn(page);
    await page.getByRole("button", { name: /Add client/ }).click();
    await page.getByLabel("Client name").fill("Bayside Dental");
    await context.clearCookies();

    await page.getByRole("button", { name: /Create/ }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /Sign in/ })).toBeVisible();
  });

  test("a stale login tab still reaches the dashboard", async ({ page, context }) => {
    await page.goto("/login");
    await signIn(await context.newPage());

    await fillLogin(page);
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  });
});
