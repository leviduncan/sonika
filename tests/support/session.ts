import { readFileSync } from "node:fs";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { assertLocalSupabase } from "./local-supabase";

/** Throwaway users in the LOCAL Supabase, plus session cookie helpers. */

export const admin = () => {
  assertLocalSupabase();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
};

export type TestUser = {
  id: string;
  email: string;
  password: string;
  agencyId: string;
  agencyName: string;
};

export async function createTestUser(): Promise<TestUser> {
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `proxy-${tag}@example.com`;
  const password = "Original-pass-123";
  const agencyName = `Hidden Agency ${tag}`;
  const db = admin();
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { agency_name: agencyName, full_name: "Proxy Test" },
  });
  if (error) throw error;
  const profile = await db.from("profiles").select("agency_id").eq("id", data.user.id).single();
  if (profile.error) throw profile.error;
  return { id: data.user.id, email, password, agencyName, agencyId: profile.data.agency_id };
}

export async function deleteTestUser(user: TestUser) {
  const db = admin();
  await db.auth.admin.deleteUser(user.id);
  await db.from("agencies").delete().eq("id", user.agencyId);
}

export async function signIn(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

// The session cookie is `base64-<json>`, split into `.0`, `.1`… when long.
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

export const authCookies = async (context: BrowserContext) =>
  (await context.cookies())
    .filter((c) => AUTH_COOKIE.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));

/** Rewrites the stored session so the next server request has to refresh it. */
export async function expireSession(context: BrowserContext) {
  const cookies = await authCookies(context);
  const raw = cookies.map((c) => c.value).join("");
  const session = {
    ...JSON.parse(Buffer.from(raw.replace(/^base64-/, ""), "base64url").toString()),
    expires_at: Math.floor(Date.now() / 1000) - 60,
  };
  let rest = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  await context.addCookies(
    cookies.map((cookie, i) => {
      const length = i === cookies.length - 1 ? rest.length : cookie.value.length;
      const value = rest.slice(0, length);
      rest = rest.slice(length);
      return { ...cookie, value };
    }),
  );
}

export const PROTECTED_ACTIONS = [
  "createSubAccount",
  "provisionClient",
  "deleteSubAccount",
  "startCheckout",
  "openBillingPortal",
];

/** Action ids from the build under test, for calling Server Actions directly. */
export function protectedActionIds(): { name: string; id: string }[] {
  const manifest = JSON.parse(
    readFileSync(".next/server/server-reference-manifest.json", "utf8"),
  ) as { node: Record<string, { exportedName?: string }> };
  return Object.entries(manifest.node)
    .filter(([, action]) => PROTECTED_ACTIONS.includes(action.exportedName ?? ""))
    .map(([id, action]) => ({ id, name: action.exportedName! }));
}
