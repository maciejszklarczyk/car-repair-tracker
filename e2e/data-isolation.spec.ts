// Risk: test-plan.md #1 — IDOR / RLS bypass (one user accessing another's data)
// Seed: e2e/seed.spec.ts

import { test, expect, type BrowserContext } from "@playwright/test";

const uid = Date.now();
const vehicleMake = `IsoMake${uid}`;
const vehicleModel = `IsoModel${uid}`;

let userACarId: string;
let userARepairId: string;

test("User B cannot see, delete User A's vehicles or repairs", async ({ page, browser }) => {
  // --- User A: create a vehicle ---
  await page.goto("/dashboard/vehicles/new");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Make").fill(vehicleMake);
  await page.getByLabel("Model").fill(vehicleModel);
  await page.getByLabel("Year").fill("2020");
  await page.getByLabel("Baseline Mileage (km)").fill("50000");
  await page.getByRole("button", { name: "Add vehicle" }).click();

  await page.waitForURL("/dashboard/vehicles");
  const vehicleHeading = page.getByRole("heading", { name: `${vehicleMake} ${vehicleModel}` });
  await expect(vehicleHeading).toBeVisible();

  // Extract car ID from "View details" link — heading's parent is the card div
  const viewDetailsLink = vehicleHeading.locator("..").getByRole("link", { name: "View details" });
  const vehicleHref = await viewDetailsLink.getAttribute("href");
  if (!vehicleHref) throw new Error("Vehicle href not found");
  userACarId = vehicleHref.split("/dashboard/vehicles/")[1];

  // --- User A: create a repair ---
  await page.goto(`/dashboard/repairs/new?vehicle_id=${userACarId}`);
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Repair Date").fill("2024-06-01");
  await page.getByLabel("Description").fill(`Isolation test repair ${uid}`);
  await page.getByLabel("Cost (PLN)").fill("500");
  await page.getByLabel("Mileage (km)").fill("55000");
  await page.getByRole("button", { name: "Add repair" }).click();

  await page.waitForURL(new RegExp(`/dashboard/vehicles/${userACarId}`));
  await expect(page.getByText("Repair added successfully")).toBeVisible();

  // Extract repair ID from the edit link
  const editLink = page.getByRole("link", { name: "Edit" }).first();
  await expect(editLink).toBeVisible();
  const editHref = await editLink.getAttribute("href");
  if (!editHref) throw new Error("Edit href not found");
  const repairMatch = /\/dashboard\/repairs\/([^/]+)\/edit/.exec(editHref);
  if (!repairMatch) throw new Error("Repair ID not found in edit href");
  userARepairId = repairMatch[1];

  // --- User B: verify cannot see User A's vehicles ---
  const userBContext: BrowserContext = await browser.newContext({
    storageState: "auth-user-b.json",
  });
  const userBPage = await userBContext.newPage();

  await userBPage.goto("/dashboard/vehicles");
  await userBPage.waitForLoadState("networkidle");

  await expect(userBPage.getByText(vehicleMake)).not.toBeVisible();
  await expect(userBPage.getByText("No vehicles yet")).toBeVisible();

  // --- User B: verify cannot delete User A's repair via API ---
  const deleteRepairResponse = await userBPage.request.delete(`/api/repairs/${userARepairId}`, {
    headers: { Origin: "http://localhost:4321" },
  });
  expect(deleteRepairResponse.status()).toBe(403);

  // --- User B: verify cannot delete User A's vehicle via API ---
  const deleteVehicleResponse = await userBPage.request.delete(`/api/vehicles/${userACarId}`, {
    headers: { Origin: "http://localhost:4321" },
  });
  expect(deleteVehicleResponse.status()).toBe(403);

  await userBContext.close();

  // --- Teardown: User A deletes vehicle (cascades to repairs) ---
  await page.request.delete(`/api/vehicles/${userACarId}`, {
    headers: { Origin: "http://localhost:4321" },
  });
});
