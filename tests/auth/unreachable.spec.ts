import { test, expect, type Page } from "@playwright/test";
import { lockProfiles, pauseGateway, resumeGateway } from "../support/local-supabase";
import {
  admin,
  authCookies,
  createTestUser,
  deleteTestUser,
  expireSession,
  PROTECTED_ACTIONS,
  protectedActionIds,
  signIn,
  type TestUser,
} from "../support/session";

/**
 * The running app while the LOCAL Supabase stops answering: the API gateway is
 * paused, or only the profiles table is locked. Everything is restored after
 * each test (see tests/support/local-supabase.ts).
 */

let user: TestUser;
let clientId: string;
let unlock: (() => Promise<void>) | undefined;
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
  await unlock?.();
  await resumeGateway();
  await deleteTestUser(user);
});

test.afterAll(resumeGateway);

const protectedPages = () => ["/dashboard", "/dashboard/billing", `/dashboard/clients/${clientId}`];
const heading = (page: Page, name: string) => page.getByRole("heading", { name });
// The proxy waits 3s, then the page or action waits up to 3s more.
const PATIENCE = { timeout: 12_000 };

/**
 * Signs in and waits out the dashboard's link prefetches. One still in flight
 * would refresh the session while Supabase is up, in the middle of the test.
 */
async function signInAndSettle(page: Page) {
  await signIn(page, user);
  await page.goto("/dashboard", { waitUntil: "networkidle" });
}

const clientNames = async () => {
  const { data, error } = await admin()
    .from("sub_accounts")
    .select("name")
    .eq("agency_id", user.agencyId);
  if (error) throw error;
  return data.map((row) => row.name);
};

for (const expired of [false, true]) {
  const state = expired ? "expired" : "current";

  test(`paused, ${state} session: public pages still load`, async ({ page, context }) => {
    await signInAndSettle(page);
    if (expired) await expireSession(context);
    pauseGateway();

    for (const path of ["/", "/login", "/signup", "/forgot-password"]) {
      const started = Date.now();
      const res = await context.request.get(path, { maxRedirects: 0, timeout: 20_000 });
      expect(res.status(), path).toBe(200);
      expect(Date.now() - started, path).toBeLessThan(5000);
    }
  });

  test(`paused, ${state} session: protected pages show the error page and no data`, async ({
    page,
    context,
  }) => {
    test.slow();
    await signInAndSettle(page);
    if (expired) await expireSession(context);
    const before = await authCookies(context);
    pauseGateway();

    for (const path of [...protectedPages(), "/reset-password", "/account-unavailable"]) {
      const started = Date.now();
      const res = await context.request.get(path, { maxRedirects: 0, timeout: 20_000 });
      expect(res.status(), path).toBe(500);
      expect(Date.now() - started, path).toBeLessThan(9000);
      const body = await res.text();
      for (const detail of [CLIENT_NAME, user.agencyName, "Link expired"]) {
        expect(body, path).not.toContain(detail);
      }
    }

    await page.goto("/dashboard");
    await expect(heading(page, "Something went wrong")).toBeVisible(PATIENCE);
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(await authCookies(context), "the outage didn't touch the session").toEqual(before);

    await resumeGateway();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(heading(page, "Welcome, Proxy.")).toBeVisible(PATIENCE);
  });

  test(`paused, ${state} session: Sign out clears this browser's session`, async ({
    page,
    context,
  }) => {
    await signInAndSettle(page);
    if (expired) await expireSession(context);
    pauseGateway();

    // The dashboard is already on screen, so this is its own Sign out button.
    await page.getByRole("button", { name: /Sign out/ }).click();
    await expect(page).toHaveURL(/\/login$/, PATIENCE);
    expect((await authCookies(context)).filter((c) => c.value)).toHaveLength(0);

    await resumeGateway();
    await signInAndSettle(page);
  });
}

test("paused: Sign out on the error page works", async ({ page, context }) => {
  test.slow();
  await signInAndSettle(page);
  pauseGateway();
  await page.goto("/dashboard");
  await expect(heading(page, "Something went wrong")).toBeVisible(PATIENCE);

  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page).toHaveURL(/\/login$/, PATIENCE);
  expect((await authCookies(context)).filter((c) => c.value)).toHaveLength(0);
});

test("paused: every protected Server Action fails without acting", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(120_000);
  await signInAndSettle(page);
  const actions = protectedActionIds();
  expect(actions.map((a) => a.name).sort()).toEqual([...PROTECTED_ACTIONS].sort());
  pauseGateway();

  for (const { id, name } of actions) {
    const path = ["startCheckout", "openBillingPortal"].includes(name)
      ? "/dashboard/billing"
      : "/dashboard";
    const res = await context.request.post(path, {
      maxRedirects: 0,
      timeout: 20_000,
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

  await resumeGateway();
  expect(await clientNames()).toEqual([CLIENT_NAME]);
});

test("paused: Add client creates nothing", async ({ page }) => {
  await signInAndSettle(page);
  await page.getByRole("button", { name: /Add client/ }).click();
  await page.getByLabel("Client name").fill("Bayside Dental");
  pauseGateway();

  await page.getByRole("button", { name: /Create/ }).click();
  await expect(heading(page, "Something went wrong")).toBeVisible(PATIENCE);

  await resumeGateway();
  expect(await clientNames()).toEqual([CLIENT_NAME]);
});

test("profile lookup hangs: the error page appears and no data does", async ({ page, context }) => {
  await signInAndSettle(page);
  unlock = await lockProfiles();

  const started = Date.now();
  const res = await context.request.get("/dashboard", { maxRedirects: 0, timeout: 20_000 });
  expect(res.status()).toBe(500);
  expect(Date.now() - started).toBeLessThan(5000);
  expect(await res.text()).not.toContain(CLIENT_NAME);

  await unlock();
  await page.goto("/dashboard");
  await expect(heading(page, "Welcome, Proxy.")).toBeVisible();
});
