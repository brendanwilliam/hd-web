import { expect, test } from "@playwright/test";

test("home page presents Hands Diff and device linking", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /your game inputs/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /link obs/i })).toHaveAttribute(
    "href",
    "/link",
  );
});

test("navigation reaches the device-link entry page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Hands Diff" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole("link", { name: /link obs/i }).click();
  await expect(page).toHaveURL(/\/link$/);
  await expect(page.getByRole("heading", { name: "Link Hands Diff" })).toBeVisible();
  await expect(page.getByRole("link", { name: /continue with github/i })).toBeVisible();
});

test("device-link page preserves a valid supplied code", async ({ page }) => {
  await page.goto("/link?code=ABCD-1234");

  await expect(page.getByRole("link", { name: /continue with github/i })).toHaveAttribute(
    "href",
    "/api/auth/github?code=ABCD-1234",
  );
});
