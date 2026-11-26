import { test, expect } from "@playwright/test";

/**
 * Password reset smoke checks. These never submit the email form, so they
 * don't send mail or hit Supabase's email rate limit. The full email
 * round-trip was verified against local Supabase + Mailpit (see build log).
 */

test("login links to forgot-password", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeVisible();
});

test("expired link lands on forgot-password with an error", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=not-a-real-token&type=recovery&next=/reset-password");
  await expect(page).toHaveURL(/\/forgot-password\?error=link_expired/);
  await expect(page.locator("form [role=alert]")).toContainText("invalid or has expired");
});

test("confirm ignores off-site next targets", async ({ page }) => {
  await page.goto("/auth/confirm?next=//evil.example");
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/forgot-password/);
});

test("reset-password without a session shows the expired state", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: "Link expired" })).toBeVisible();
  await page.getByRole("link", { name: /Request a new link/ }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});
