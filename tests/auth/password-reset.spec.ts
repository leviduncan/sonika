import { test, expect, type Page } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { ALLOWED_NEXT_PATHS, safeNext } from "../../src/lib/auth/redirect";

/**
 * Password reset checks.
 *
 * The first group needs nothing but the app. The second group drives real
 * recovery tokens: it creates throwaway users with the Supabase admin API and
 * mints links with `generateLink` (which sends no email). It only runs when
 * .env.local points at a LOCAL Supabase (`supabase start`), never a hosted
 * project, and deletes what it creates.
 */

loadEnvConfig(process.cwd());
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const LOCAL_SUPABASE =
  /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(SUPABASE_URL) && !!SERVICE_KEY && !!ANON_KEY;

const ON_SITE = /^http:\/\/localhost:\d+\//;
const EXPIRED_URL = /^http:\/\/localhost:\d+\/forgot-password\?error=link_expired$/;
// Anchored: the confirm URL itself ends in `next=/reset-password`.
const RESET_URL = /^http:\/\/localhost:\d+\/reset-password$/;
const OFF_SITE_NEXT = ["//evil.example", "/%09/evil.example"];

// ── No Supabase fixtures needed ─────────────────────────────────────────────

test("safeNext only allows the exact allowlisted paths", () => {
  for (const path of ALLOWED_NEXT_PATHS) expect(safeNext(path)).toBe(path);

  const hostile = [
    "//evil.example",
    "/\t/evil.example", // what `/%09/evil.example` decodes to
    "/%09/evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "/dashboard/../../evil",
    "/dashboard?x=1",
    "/reset-password#x",
    "/Dashboard",
    " /dashboard",
    "",
    null,
    undefined,
    ["/dashboard"],
  ];
  for (const value of hostile) expect(safeNext(value), JSON.stringify(value)).toBe("/dashboard");
});

test("login links to forgot-password", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeVisible();
});

test("confirm GET only shows a Continue page; a bad token fails on POST", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=not-a-real-token&type=recovery&next=/reset-password");
  await expect(page).toHaveURL(/\/auth\/confirm\?/);
  await expect(page.getByRole("button", { name: /Continue/ })).toBeVisible();

  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page).toHaveURL(EXPIRED_URL);
  await expect(page.locator("form [role=alert]")).toContainText("invalid or has expired");
});

for (const next of OFF_SITE_NEXT) {
  test(`confirm keeps next=${next} on-site`, async ({ page }) => {
    await page.goto(`/auth/confirm?token_hash=not-a-real-token&type=recovery&next=${next}`);
    await expect(page.locator("input[name=next]")).toHaveValue("/dashboard");
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page).toHaveURL(ON_SITE);
    await expect(page).toHaveURL(EXPIRED_URL);
  });
}

test("confirm rejects every token type except recovery", async ({ page }) => {
  for (const type of ["signup", "magiclink", "invite", "email", "email_change", ""]) {
    await page.goto(`/auth/confirm?token_hash=anything&type=${type}&next=/reset-password`);
    await expect(page, `type=${type}`).toHaveURL(EXPIRED_URL);
  }
  await page.goto("/auth/confirm?code=some-pkce-code&next=/reset-password");
  await expect(page).toHaveURL(EXPIRED_URL);
});

test("reset-password without a session shows the expired state", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: "Link expired" })).toBeVisible();
  await page.getByRole("link", { name: /Request a new link/ }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});

test("forgot-password keeps the email filled after submit", async ({ page }) => {
  // Unknown address: Supabase accepts it and sends nothing.
  const email = `nobody-${Date.now()}@example.com`;
  await page.goto("/forgot-password");
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: /Send reset link/ }).click();
  await expect(page.getByRole("status")).toContainText("If that email has a Sonika account");
  await expect(page.getByLabel("Work email")).toHaveValue(email);
});

// ── Real recovery tokens (local Supabase only) ──────────────────────────────

test.describe("with a real recovery token", () => {
  test.skip(!LOCAL_SUPABASE, "Needs .env.local pointing at a local Supabase (supabase start).");

  const admin = () =>
    createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  type TestUser = { id: string; email: string; password: string };
  let user: TestUser;

  test.beforeEach(async () => {
    const email = `pwreset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const password = "Original-pass-123";
    const { data, error } = await admin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { agency_name: "Reset Test Agency", full_name: "Reset Test" },
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

  async function tokenHash() {
    const { data, error } = await admin().auth.admin.generateLink({
      type: "recovery",
      email: user.email,
    });
    if (error) throw error;
    return data.properties.hashed_token;
  }

  const confirmUrl = (hash: string, next = "/reset-password", type = "recovery") =>
    `/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=${type}&next=${next}`;

  async function canSignIn(password: string) {
    const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { error } = await client.auth.signInWithPassword({ email: user.email, password });
    return !error;
  }

  async function signInWithPassword(page: Page) {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: /Sign in/ }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  }

  test("a scanner GET doesn't spend the token; Continue does, once", async ({ page, request }) => {
    const url = confirmUrl(await tokenHash());

    // What an email security scanner does: fetch the link, maybe twice.
    expect((await request.get(url)).ok()).toBe(true);
    expect((await request.get(url)).ok()).toBe(true);

    await page.goto(url);
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page).toHaveURL(RESET_URL);
    await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();

    // Single use: the same link now fails.
    await page.goto(url);
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page).toHaveURL(EXPIRED_URL);
  });

  for (const next of OFF_SITE_NEXT) {
    test(`a valid token with next=${next} still lands on-site`, async ({ page }) => {
      await page.goto(confirmUrl(await tokenHash(), next));
      await page.getByRole("button", { name: /Continue/ }).click();
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/dashboard/);
    });
  }

  test("a signup-confirmation token is refused, even relabelled as recovery", async ({ page }) => {
    // (Magic-link tokens aren't a useful case here: GoTrue stores them in the
    // same slot as recovery tokens, and Sonika never sends magic links.)
    const db = admin();
    const { data, error } = await db.auth.admin.generateLink({
      type: "signup",
      email: `pwreset-signup-${Date.now()}@example.com`,
      password: "Signup-pass-123",
    });
    if (error) throw error;
    const signupHash = data.properties.hashed_token;

    try {
      await page.goto(confirmUrl(signupHash, "/reset-password", "signup"));
      await expect(page).toHaveURL(EXPIRED_URL);

      // The POST always verifies as `recovery`, so the label in the URL can't widen it.
      await page.goto(confirmUrl(signupHash));
      await page.getByRole("button", { name: /Continue/ }).click();
      await expect(page).toHaveURL(EXPIRED_URL);
    } finally {
      const { data: profile } = await db
        .from("profiles")
        .select("agency_id")
        .eq("id", data.user.id)
        .maybeSingle();
      await db.auth.admin.deleteUser(data.user.id);
      if (profile?.agency_id) await db.from("agencies").delete().eq("id", profile.agency_id);
    }
  });

  test("recovery sets a short-lived httpOnly, secure, lax cookie", async ({ page, context }) => {
    await page.goto(confirmUrl(await tokenHash()));
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page).toHaveURL(RESET_URL);

    const cookie = (await context.cookies()).find((c) => c.name === "sonika_recovery");
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.secure).toBe(true);
    expect(cookie!.sameSite).toBe("Lax");
    const ttl = cookie!.expires - Date.now() / 1000;
    expect(ttl).toBeGreaterThan(14 * 60);
    expect(ttl).toBeLessThanOrEqual(15 * 60 + 5);
  });

  test("full reset: new password works, other sessions are signed out", async ({ page, browser }) => {
    // Another device, signed in with the old password.
    const otherDevice = await browser.newContext();
    const otherPage = await otherDevice.newPage();
    await signInWithPassword(otherPage);

    await page.goto(confirmUrl(await tokenHash()));
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.getByLabel("New password").fill("Brand-new-pass-456");
    await page.getByLabel("Confirm password").fill("Brand-new-pass-456");
    await page.getByRole("button", { name: /Update password/ }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    expect((await page.context().cookies()).some((c) => c.name === "sonika_recovery")).toBe(false);
    expect(await canSignIn("Brand-new-pass-456")).toBe(true);
    expect(await canSignIn(user.password)).toBe(false);

    await otherPage.goto("/dashboard");
    await expect(otherPage).toHaveURL(/\/login/);
    await otherDevice.close();
  });

  test("a normal password sign-in can't change the password", async ({ page }) => {
    await signInWithPassword(page);
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: "Link expired" })).toBeVisible();
    expect(await canSignIn(user.password)).toBe(true);
  });

  test("updatePassword re-checks the recovery cookie on the server", async ({ page, context }) => {
    await page.goto(confirmUrl(await tokenHash()));
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();

    // Form is on screen, but the recovery proof is gone (or was never there).
    await context.clearCookies({ name: "sonika_recovery" });
    await page.getByLabel("New password").fill("Brand-new-pass-456");
    await page.getByLabel("Confirm password").fill("Brand-new-pass-456");
    await page.getByRole("button", { name: /Update password/ }).click();
    await expect(page.locator("form [role=alert]")).toContainText("expired");
    expect(await canSignIn(user.password)).toBe(true);
  });

  test("forgot-password says the same thing for a real account", async ({ page }) => {
    const answers: string[] = [];
    for (const email of [`nobody-${Date.now()}@example.com`, user.email]) {
      await page.goto("/forgot-password");
      await page.getByLabel("Work email").fill(email);
      await page.getByRole("button", { name: /Send reset link/ }).click();
      const status = page.getByRole("status");
      await expect(status).toBeVisible();
      answers.push((await status.textContent()) ?? "");
    }
    expect(answers[1]).toBe(answers[0]);
  });
});
