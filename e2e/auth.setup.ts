import { test as setup, expect } from "@playwright/test";

const users = [
  { email: "test@test.com", password: "password123", state: "auth-user-a.json" },
  { email: "test2@test.com", password: "password123", state: "auth-user-b.json" },
];

for (const user of users) {
  setup(`authenticate ${user.email}`, async ({ page }) => {
    await page.goto("/auth/signin");
    await page.waitForLoadState("networkidle");

    await page.locator("#email").fill(user.email);
    await page.getByRole("textbox", { name: "Password" }).fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(user.email)).toBeVisible();
    await page.context().storageState({ path: user.state });
  });
}
