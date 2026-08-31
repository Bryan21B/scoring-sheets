import { expect, test } from "@playwright/test";

/**
 * Smoke test proving the deployment contract holds on a real production build:
 * the app boots, serves HTML, and its health probe reports a reachable
 * database. If this fails, the container will fail its healthcheck too.
 */
test("health probe reports ok with a reachable database", async ({ request }) => {
  const response = await request.get("/health");

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});

test("home page renders", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
