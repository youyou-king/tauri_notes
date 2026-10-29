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

test("selects multiple paragraphs for a view", async ({ page }) => {
  await page.goto("/e2e.html");
  await page.locator(".mind-map-node-doc").first().click();
  await expect(page.getByText("测试文档").first()).toBeVisible();

  await page.getByRole("button", { name: "插入视图" }).click();
  await expect(page.getByText("尚未选择引用内容")).toBeVisible();
  await expect(page.getByText(/拖入/)).toHaveCount(0);
  await page.getByRole("button", { name: "选择内容", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "选择引用内容" }),
  ).toBeVisible();
  const blockNodes = page.locator(
    ".viewport-selection-document [data-block-id]",
  );
  await expect(blockNodes).toHaveCount(3);
  const first = await blockNodes.nth(0).boundingBox();
  const second = await blockNodes.nth(1).boundingBox();
  if (!first || !second) {
    throw new Error("reference document blocks are not visible");
  }
  await page.mouse.move(first.x + 20, first.y + 12);
  await page.mouse.down();
  await page.mouse.move(second.x + 20, second.y + 12, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByText("已选 2 段")).toBeVisible();
  await page.getByRole("button", { name: "添加引用" }).click();
  await expect(page.locator(".proto-viewport")).toContainText(
    "用于插入视图的示例内容",
  );
  await expect(page.locator(".proto-viewport")).toContainText("第二段示例内容");

  await page.getByRole("button", { name: "管理引用" }).click();
  await expect(page.getByText("已选 2 段")).toBeVisible();
  const manageSecond = await page
    .locator(".viewport-selection-document [data-block-id]")
    .nth(1)
    .boundingBox();
  if (!manageSecond) {
    throw new Error("managed reference block is not visible");
  }
  await page.mouse.move(manageSecond.x + 20, manageSecond.y + 8);
  await page.mouse.down();
  await page.mouse.move(manageSecond.x + 60, manageSecond.y + 8);
  await page.mouse.up();
  await expect(page.getByText("已选 1 段")).toBeVisible();
  await page.getByRole("button", { name: "添加引用" }).click();
  await expect(page.locator(".proto-viewport")).not.toContainText(
    "用于插入视图的示例内容",
  );

  await page.getByRole("button", { name: "添加内容" }).click();
  await expect(
    page.getByRole("dialog", { name: "选择引用内容" }),
  ).toBeVisible();
});

test("drags a map node without resetting its position", async ({ page }) => {
  await page.goto("/e2e.html");
  const node = page
    .locator(".react-flow__node")
    .filter({ hasText: "测试想法" })
    .first();
  await expect(node).toBeVisible();
  const before = await node.boundingBox();
  if (!before) {
    throw new Error("map node has no bounding box");
  }
  const startX = before.x + before.width / 2;
  const startY = before.y + before.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY + 40, { steps: 12 });
  const during = await node.boundingBox();
  expect(during?.x ?? 0).toBeGreaterThan(before.x + 30);
  await page.mouse.up();

  await page.waitForTimeout(400);
  const after = await node.boundingBox();
  expect(after?.x ?? 0).toBeGreaterThan(before.x + 30);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as Window & { __E2E_CALLS__?: string[] }
        ).__E2E_CALLS__?.includes("set_map_node_position"),
      ),
    )
    .toBe(true);
});

test("opens the heading document with Ctrl + left click", async ({ page }) => {
  await page.goto("/e2e.html");
  await page.locator(".mind-map-node-doc").first().click();
  await expect(page.getByText("测试文档").first()).toBeVisible();

  const heading = page
    .locator(".imported-preview-surface h1")
    .filter({ hasText: "测试标题" });
  await expect(heading).toBeVisible();
  await heading.click({ modifiers: ["Control"] });
  await expect(
    page.getByRole("dialog", { name: "创建文档" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "创建文档" }).click();

  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as Window & { __E2E_CALLS__?: string[] }
        ).__E2E_CALLS__?.includes("create_document_for_map_node"),
      ),
    )
    .toBe(true);
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

test("opens the help knowledge base from the toolbar", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();

  await page.getByRole("button", { name: "帮助" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as Window & { __E2E_CALLS__?: string[] }).__E2E_CALLS__?.includes(
          "help_note_path",
        ),
      ),
    )
    .toBe(true);
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

