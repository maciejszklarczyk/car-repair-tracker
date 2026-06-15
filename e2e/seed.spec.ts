import { test, expect } from "@playwright/test";

const uid = Date.now();

test("add vehicle and verify it appears in vehicle list", async ({ page }) => {
  const make = `TestMake${uid}`;
  const model = `TestModel${uid}`;

  await page.goto("/dashboard/vehicles/new");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Make").fill(make);
  await page.getByLabel("Model").fill(model);
  await page.getByLabel("Year").fill("2020");
  await page.getByLabel("Baseline Mileage (km)").fill("100000");
  await page.getByRole("button", { name: "Add vehicle" }).click();

  await page.waitForURL("/dashboard/vehicles");
  await expect(page.getByText(make)).toBeVisible();
});
