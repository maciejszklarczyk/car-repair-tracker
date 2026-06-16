// Risk: test-plan.md #5 — Repair delete/edit silently corrupts data or skips cost/km recalculation
// Seed: e2e/seed.spec.ts

import { test, expect } from "@playwright/test";

const uid = Date.now();
const vehicleMake = `LifeMake${uid}`;
const vehicleModel = `LifeModel${uid}`;
const baselineMileage = 50000;
const repairMileage = 55000;
const kmDriven = repairMileage - baselineMileage; // 5000

const initialCost = 500;
const editedCost = 1000;

// Hand-calculated oracle values (NOT the production formula)
const expectedCostAfterAdd = (initialCost / kmDriven).toFixed(2); // "0.10"
const expectedCostAfterEdit = (editedCost / kmDriven).toFixed(2); // "0.20"

let vehicleId: string;
let repairId: string;

test("repair add/edit/delete triggers correct cost/km recalculation", async ({ page }) => {
  test.setTimeout(60_000);

  // --- Step 1: Create a vehicle with known baseline mileage ---
  await page.goto("/dashboard/vehicles/new");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Make").fill(vehicleMake);
  await page.getByLabel("Model").fill(vehicleModel);
  await page.getByLabel("Year").fill("2020");
  await page.getByLabel("Baseline Mileage (km)").fill(String(baselineMileage));
  await page.getByRole("button", { name: "Add vehicle" }).click();

  await page.waitForURL("/dashboard/vehicles");

  // Extract vehicle ID from "View details" link
  const vehicleHeading = page.getByRole("heading", {
    name: `${vehicleMake} ${vehicleModel}`,
  });
  await expect(vehicleHeading).toBeVisible();
  const viewDetailsLink = vehicleHeading.locator("..").getByRole("link", { name: "View details" });
  const vehicleHref = await viewDetailsLink.getAttribute("href");
  if (!vehicleHref) throw new Error("Vehicle href not found");
  vehicleId = vehicleHref.split("/dashboard/vehicles/")[1];

  // --- Step 2: Add a repair with known cost and mileage ---
  await page.goto(`/dashboard/repairs/new?vehicle_id=${vehicleId}`);
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Repair Date").fill("2024-06-01");
  await page.getByLabel("Description").fill(`Lifecycle test repair ${uid}`);
  await page.getByLabel("Cost (PLN)").fill(String(initialCost));
  await page.getByLabel("Mileage (km)").fill(String(repairMileage));
  await page.getByRole("button", { name: "Add repair" }).click();

  // Native form POST redirects to vehicle detail with ?success=1
  await page.waitForURL(new RegExp(`/dashboard/vehicles/${vehicleId}`));
  await expect(page.getByText("Repair added successfully")).toBeVisible();

  // --- Step 3: Assert cost/km after add ---
  await expect(page.getByText(`${expectedCostAfterAdd} PLN/km`)).toBeVisible();

  // Extract repair ID from the Edit link
  const editLink = page.getByRole("link", { name: "Edit" }).first();
  await expect(editLink).toBeVisible();
  const editHref = await editLink.getAttribute("href");
  if (!editHref) throw new Error("Edit href not found");
  const repairMatch = /\/dashboard\/repairs\/([^/]+)\/edit/.exec(editHref);
  if (!repairMatch) throw new Error("Repair ID not found in edit href");
  repairId = repairMatch[1];

  // --- Step 4: Edit the repair cost ---
  await page.goto(`/dashboard/repairs/${repairId}/edit`);
  await page.waitForLoadState("networkidle");

  const costField = page.getByLabel("Cost (PLN)", { exact: false });
  await expect(costField).toBeVisible();
  await costField.fill(String(editedCost));

  const saveBtn = page.getByRole("button", { name: "Save changes" });
  await expect(saveBtn).toBeEnabled();
  await saveBtn.click();

  // Edit form uses fetch PUT + window.location.href redirect
  await page.waitForURL(new RegExp(`/dashboard/vehicles/${vehicleId}\\?success=updated`));
  await expect(page.getByText("Repair saved")).toBeVisible();

  // --- Step 5: Assert cost/km after edit ---
  await expect(page.getByText(`${expectedCostAfterEdit} PLN/km`)).toBeVisible();

  // --- Step 6: Delete the repair ---
  // Click the Delete button to open the AlertDialog
  await page.getByRole("button", { name: "Delete" }).click();
  // Confirm deletion in the dialog
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete" }).click();

  // Delete triggers window.location.reload() — wait for fresh SSR
  await page.waitForLoadState("networkidle");

  // --- Step 7: Assert cost/km resets to no-data state ---
  await expect(page.getByText("— PLN/km — no cost data yet")).toBeVisible();

  // --- Teardown: delete the test vehicle via API ---
  // No vehicle delete API exists, but orphan data is harmless (unique names prevent collision)
});
