import { expect, test } from "@playwright/test";

test("loads the demo workspace and switches theme", async ({ page }) => {
  await page.goto("/e2e.html");

  await expect(page.getByText(/演示知识库/).first()).toBeVisible();
  await expect(page.getByText("演示导图").first()).toBeVisible();
  await expect(page.locator(".mind-map-flow")).toHaveCSS(
    "background-color",
    "rgb(15, 18, 24)",
  );

  await page.getByRole("button", { name: /主题/ }).click();
  await page.getByRole("button", { name: "浅色" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".mind-map-flow")).toHaveCSS(
    "background-color",
    "rgb(248, 248, 245)",
  );

  await page.getByRole("button", { name: /主题/ }).click();
  await page.getByRole("button", { name: "深色" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("opens a document from a mind-map node", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText("测试想法").first()).toBeVisible();

  await page.locator(".mind-map-node-doc").first().click();
  await expect(page.getByText("测试文档").first()).toBeVisible();
});

test("creates and applies a custom theme", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();

  await page.getByRole("button", { name: /主题/ }).click();
  await page.getByRole("button", { name: "新建主题…" }).click();
  await expect(page.getByRole("heading", { name: "新建主题" })).toBeVisible();

  await page.getByLabel("主题名称").fill("E2E 主题");
  await page.getByRole("button", { name: "保存并应用" }).click();

  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-mode",
    /^custom:/,
  );

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-mode",
    /^custom:/,
  );
});

test("opens the board with the keyboard shortcut", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();

  await page.keyboard.press("Control+Shift+b");
  await expect(page.getByText("对照板").first()).toBeVisible();
});

test("closes and reopens the map panel", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.locator(".mind-map-flow")).toBeVisible();

  await page.locator(".workspace-tab-close").nth(1).click();
  await expect(page.locator(".mind-map-flow")).toHaveCount(0);

  await page.locator(".outline-map-row").first().click();
  await expect(page.locator(".mind-map-flow")).toBeVisible();
});

test("opens the console from the view menu", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();

  await page.getByRole("button", { name: "视图 ▾", exact: true }).click();
  await page.getByRole("button", { name: "控制台" }).click();
  await expect(page.locator(".console-panel")).toBeVisible();
});

test("opens the knowledge menu", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();

  await page.getByRole("button", { name: "知识库 ▾", exact: true }).click();
  await expect(page.getByRole("button", { name: "新建知识库…" })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开知识库…" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存" })).toBeVisible();
});

test("closes the knowledge menu on outside click", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();

  await page.getByRole("button", { name: "知识库 ▾", exact: true }).click();
  await expect(page.getByRole("button", { name: "新建知识库…" })).toBeVisible();

  await page.locator(".dock-fill").click({ position: { x: 40, y: 40 } });
  await expect(
    page.getByRole("button", { name: "新建知识库…" }),
  ).toHaveCount(0);
});

test("opens the search palette with the keyboard shortcut", async ({
  page,
}) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();

  await page.keyboard.press("Control+p");
  await expect(page.locator(".palette")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".palette")).toHaveCount(0);
});

