import { test, expect, type Page } from "@playwright/test";
import { restoreProfilesRead, revokeProfilesRead } from "../support/local-supabase";
import {
  admin,
  authCookies,
  createTestUser,
  deleteTestUser,
  PROTECTED_ACTIONS,
  protectedActionIds,
  signIn,
  type TestUser,
} from "../support/session";

/**
 * A signed-in user whose workspace can't be resolved: either there is no
 * profile row, or looking it up fails. Local Supabase only (see
 * tests/support/local-supabase.ts).
 */

let user: TestUser;
let clientId: string;
const CLIENT_NAME = "Hidden Client Dental";

test.beforeEach(async () => {
  user = await createTestUser();
  const { data, error } = await admin()
    .from("sub_accounts")
    .insert({ agency_id: user.agencyId, name: CLIENT_NAME })
    .select("id")
    .single();
  if (error) throw error;
  clientId = data.id;
});

test.afterEach(async () => {
  await restoreProfilesRead();
  await deleteTestUser(user);
});

test.afterAll(restoreProfilesRead);

const protectedPages = () => ["/dashboard", "/dashboard/billing", `/dashboard/clients/${clientId}`];

const heading = (page: Page, name: string) => page.getByRole("heading", { name });

async function deleteProfile() {
  const { error } = await admin().from("profiles").delete().eq("id", user.id);
  if (error) throw error;
}

const clientNames = async () => {
  const { data, error } = await admin()
    .from("sub_accounts")
    .select("name")
    .eq("agency_id", user.agencyId);
  if (error) throw error;
  return data.map((row) => row.name);
};

// ── No profile row ──────────────────────────────────────────────────────────

test("no profile: every entry point ends on /account-unavailable, with no loop", async ({
  page,
}) => {
  await signIn(page, user);
  await deleteProfile();

  for (const path of [...protectedPages(), "/login", "/signup"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/account-unavailable$/);
    await expect(heading(page, "Account unavailable")).toBeVisible();
  }

  const html = await page.content();
  for (const detail of [user.email, user.id, user.agencyId, user.agencyName, CLIENT_NAME]) {
    expect(html, "the page shows no account details").not.toContain(detail);
  }
});

test("no profile: Sign out ends the session and reaches /login", async ({ page, context }) => {
  await signIn(page, user);
  await deleteProfile();

  await page.goto("/dashboard");
  await page.getByRole("button", { name: /Sign out/ }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: /Sign in/ })).toBeVisible();
  expect((await authCookies(context)).filter((c) => c.value)).toHaveLength(0);
});

test("/account-unavailable sends everyone else elsewhere", async ({ page }) => {
  await page.goto("/account-unavailable");
  await expect(page).toHaveURL(/\/login$/);

  await signIn(page, user);
  await page.goto("/account-unavailable");
  await expect(page).toHaveURL(/\/dashboard$/);
});

// ── The profile lookup fails ────────────────────────────────────────────────

async function expectErrorPage(page: Page) {
  await expect(heading(page, "Something went wrong")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign out/ })).toBeVisible();

  const visible = await page.locator("body").innerText();
  expect(visible).not.toMatch(/permission denied|profile lookup|digest|error:|\bat \S+:\d+/i);
  const html = await page.content();
  for (const detail of [user.id, user.agencyId, user.agencyName, CLIENT_NAME, "permission denied"]) {
    expect(html).not.toContain(detail);
  }
}

test("lookup error: every protected page shows the error page and no data", async ({
  page,
  context,
}) => {
  await signIn(page, user);
  await revokeProfilesRead();

  for (const path of protectedPages()) {
    const raw = await context.request.get(path, { maxRedirects: 0 });
    expect(raw.status(), path).toBe(500);
    const body = await raw.text();
    expect(body, path).not.toContain(CLIENT_NAME);
    expect(body, path).not.toContain(user.agencyName);

    await page.goto(path);
    await expect(page, path).toHaveURL(new RegExp(`${path}$`));
    await expectErrorPage(page);
  }
});

test("lookup error: Try again recovers once the lookup works", async ({ page }) => {
  await signIn(page, user);
  await revokeProfilesRead();
  await page.goto("/dashboard");
  await expectErrorPage(page);

  await restoreProfilesRead();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(heading(page, "Welcome, Proxy.")).toBeVisible();
});

test("lookup error: Sign out on the error page works", async ({ page, context }) => {
  await signIn(page, user);
  await revokeProfilesRead();
  await page.goto("/dashboard");

  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: /Sign in/ })).toBeVisible();
  expect((await authCookies(context)).filter((c) => c.value)).toHaveLength(0);
});

test("lookup error: every protected Server Action fails without acting", async ({
  page,
  context,
  baseURL,
}) => {
  await signIn(page, user);
  await revokeProfilesRead();

  const actions = protectedActionIds();
  expect(actions.map((a) => a.name).sort()).toEqual([...PROTECTED_ACTIONS].sort());

  for (const { id, name } of actions) {
    // Post to a page that uses the action. Next forwards it otherwise, and the
    // forwarded response loses the error status.
    const path = ["startCheckout", "openBillingPortal"].includes(name)
      ? "/dashboard/billing"
      : "/dashboard";
    const res = await context.request.post(path, {
      maxRedirects: 0,
      headers: {
        "Next-Action": id,
        Origin: baseURL!,
        Accept: "text/x-component",
        "Content-Type": "text/plain;charset=UTF-8",
      },
      data: "[null,null]",
    });
    expect(res.status(), name).toBe(500);
    expect(res.headers()["x-action-redirect"], name).toBeUndefined();
    const body = await res.text();
    expect(body, `${name} ends in an error, not a result`).toMatch(/^1:E\{/m);
    expect(body, name).not.toContain(user.agencyName);
  }
  expect(await clientNames()).toEqual([CLIENT_NAME]);
});

test("lookup error: Add client creates nothing", async ({ page }) => {
  await signIn(page, user);
  await page.getByRole("button", { name: /Add client/ }).click();
  await page.getByLabel("Client name").fill("Bayside Dental");
  await revokeProfilesRead();

  await page.getByRole("button", { name: /Create/ }).click();
  await expect(heading(page, "Something went wrong")).toBeVisible();
  expect(await clientNames()).toEqual([CLIENT_NAME]);
});
