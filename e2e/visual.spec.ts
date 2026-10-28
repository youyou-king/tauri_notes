import { expect, test } from "@playwright/test";

test.describe("visual regression", () => {
  test.use({ viewport: { width: 1400, height: 900 } });

  test("dark workspace", async ({ page }) => {
    await page.goto("/e2e.html");
    await expect(page.getByText(/演示知识库/).first()).toBeVisible();
    await expect(page.locator(".mind-map-flow")).toBeVisible();
    await page.waitForTimeout(250);
    await expect(page).toHaveScreenshot("workspace-dark.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  });

  test("light workspace", async ({ page }) => {
    await page.goto("/e2e.html");
    await expect(page.getByText(/演示知识库/).first()).toBeVisible();
    await page.getByRole("button", { name: /主题/ }).click();
    await page.getByRole("button", { name: "浅色" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.waitForTimeout(250);
    await expect(page).toHaveScreenshot("workspace-light.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  });

  test("theme editor", async ({ page }) => {
    await page.goto("/e2e.html");
    await page.getByRole("button", { name: /主题/ }).click();
    await page.getByRole("button", { name: "新建主题…" }).click();
    await expect(page.getByRole("heading", { name: "新建主题" })).toBeVisible();
    await expect(page).toHaveScreenshot("theme-editor.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  });

  test("light document panel", async ({ page }) => {
    await page.goto("/e2e.html");
    await page.getByRole("button", { name: /主题/ }).click();
    await page.getByRole("button", { name: "浅色" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.locator(".mind-map-node-doc").first().click();
    await expect(page.getByText("测试文档").first()).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot("document-light.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  });

  test("light theme editor", async ({ page }) => {
    await page.goto("/e2e.html");
    await page.getByRole("button", { name: /主题/ }).click();
    await page.getByRole("button", { name: "浅色" }).click();
    await page.getByRole("button", { name: /主题/ }).click();
    await page.getByRole("button", { name: "新建主题…" }).click();
    await expect(page.getByRole("heading", { name: "新建主题" })).toBeVisible();
    await expect(page).toHaveScreenshot("theme-editor-light.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  });
});
