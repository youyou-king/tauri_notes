import { expect, test } from "@playwright/test";

function storedZip(files: Array<[string, string]>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let localOffset = 0;
  for (const [path, content] of files) {
    const name = Buffer.from(path, "utf8");
    const data = Buffer.from(content, "utf8");
    const local = Buffer.alloc(30 + name.length + data.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    data.copy(local, 30 + name.length);
    locals.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centrals.push(central);
    localOffset += local.length;
  }

  const centralOffset = localOffset;
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...locals, ...centrals, eocd]);
}

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

test("keeps document blocks compact when the editor has spare height", async ({
  page,
}) => {
  await page.goto("/e2e.html");
  await page.locator(".mind-map-node-doc").first().click();
  await expect(page.getByText("测试文档").first()).toBeVisible();

  const gaps = await page
    .locator(".block-prototype-prosemirror")
    .evaluate((root) => {
      const children = [...root.children].filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      );
      return children.slice(1).map((node, index) => {
        const previous = children[index].getBoundingClientRect();
        return node.getBoundingClientRect().top - previous.bottom;
      });
    });

  expect(gaps.length).toBeGreaterThan(1);
  expect(Math.max(...gaps)).toBeLessThan(24);
});

test("syncs heading toolbar state with the current line", async ({
  page,
}) => {
  await page.goto("/e2e.html");
  await page.locator(".mind-map-node-doc").first().click();
  await expect(page.getByText("测试文档").first()).toBeVisible();

  const h1 = page.getByTitle("一级标题");
  const h2 = page.getByTitle("二级标题");

  await page
    .locator(".block-prototype-prosemirror")
    .getByText("测试标题")
    .click();
  await expect(h1).toHaveClass(/active/);
  await expect(h2).not.toHaveClass(/active/);

  await h2.click();
  await expect(h2).toHaveClass(/active/);
  await expect(h1).not.toHaveClass(/active/);

  await page
    .locator(".block-prototype-prosemirror")
    .getByText("用于插入视图的示例内容")
    .click();
  await expect(h1).not.toHaveClass(/active/);
  await expect(h2).not.toHaveClass(/active/);
});

test("inserts a table with its operation toolbar", async ({ page }) => {
  await page.goto("/e2e.html");
  await page.locator(".mind-map-node-doc").first().click();
  await expect(page.getByText("测试文档").first()).toBeVisible();

  await page.getByTitle("插入表格").click();
  await expect(page.locator(".proto-table")).toBeVisible();
  await expect(page.locator(".proto-table-tools")).toBeVisible();
  await expect(page.locator(".proto-table-tools button")).toHaveCount(4);
  await expect(page.locator(".proto-table-input").first()).toHaveValue(
    "列 1",
  );
  await expect(page.locator(".proto-table-tools button").first()).toBeVisible();
  await expect(page.locator(".proto-table tr")).toHaveCount(3);
  await page.getByRole("button", { name: "+ 行", exact: true }).click();
  await expect(page.locator(".proto-table tr")).toHaveCount(4);
});

test("recognizes pasted markdown tables", async ({ page }) => {
  await page.goto("/e2e.html");
  await page.locator(".mind-map-node-doc").first().click();
  await expect(page.getByText("测试文档").first()).toBeVisible();

  await page.locator(".ProseMirror").first().click();
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData(
      "text/plain",
      [
        "| 表头 | 表头 |",
        "| ---- | ---- |",
        "| 单元格 | 单元格 |",
      ].join("\n"),
    );
    const editor = document.querySelector(".ProseMirror");
    editor?.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });

  await expect(page.locator(".proto-table")).toBeVisible();
  await expect(page.locator(".proto-table-input").first()).toHaveValue(
    "表头",
  );
  await expect(page.locator(".proto-table-tools")).toBeVisible();
});

test("runs the viewport command from its shortcut", async ({ page }) => {
  await page.goto("/e2e.html");
  await page.locator(".mind-map-node-doc").first().click();
  await expect(page.getByText("测试文档").first()).toBeVisible();
  await page.locator(".ProseMirror").first().click();
  await page.keyboard.press("Control+Alt+V");
  await expect(page.getByText("尚未选择引用内容")).toBeVisible();
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
  expect(during?.x ?? 0).toBeGreaterThan(before.x + 20);
  await page.mouse.up();

  await expect
    .poll(async () => (await node.boundingBox())?.x ?? 0)
    .toBeGreaterThan(before.x + 20);
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

test("opens the plugin-provided appearance settings", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();
  await page.getByRole("button", { name: /主题/ }).click();
  await page.getByRole("button", { name: "外观设置…" }).click();
  await expect(page.getByRole("dialog", { name: "设置" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "外观", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "引用", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "完成" }).click();
  await expect(page.getByRole("dialog", { name: "设置" })).toBeHidden();
});

test("requires trust for a signed appearance pack", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();
  await page.getByRole("button", { name: /主题/ }).click();
  await page.getByRole("button", { name: "导入外观包…" }).click();

  const manifest = `{
    "schema": 1,
    "id": "signed-e2e",
    "name": "Signed E2E",
    "version": "1.0.0",
    "modes": ["dark"],
    "variants": {
      "dark": {
        "theme": {
          "colors": {
            "canvas": "#101010",
            "panel": "#181818",
            "text": "#ffffff",
            "textMuted": "#bbbbbb",
            "accent": "#ff5ecb"
          }
        }
      }
    },
    "signature": {
      "algorithm": "ecdsa-p256-sha256",
      "publicKey": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEmpkHkt32d1AJZSPXShSRRqVU6lNrGZeVNCRCP4c8Wm2v42VBJRLLtrwtQF9hOCD4UbTtJ-91ed2KEAPH09onPg",
      "signature": "XmGwdk29XQfNBwTIGF3hfriwjq3gGqmULA0JSP0pqKyA_STQ9iq5yn4fW2ZYmJ4npLGirzz1OGRxuWN4DUPHFw",
      "publisher": "E2E Publisher"
    }
  }`;
  const buffer = storedZip([["appearance.json", manifest]]);
  await page
    .locator('input[accept=".tnlook,.zip"]')
    .setInputFiles({
      name: "signed.tnlook",
      mimeType: "application/zip",
      buffer,
    });

  await expect(page.getByText(/发布者：E2E Publisher/)).toBeVisible();
  const apply = page.getByRole("button", { name: "应用外观" });
  await expect(apply).toBeDisabled();
  await page.getByRole("button", { name: "信任发布者" }).click();
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-appearance-pack",
    "signed-e2e",
  );
});

test("warns about low contrast appearance packs", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();
  await page.getByRole("button", { name: /主题/ }).click();
  await page.getByRole("button", { name: "导入外观包…" }).click();

  const manifest = JSON.stringify({
    schema: 1,
    id: "low-contrast",
    name: "低对比度",
    version: "1.0.0",
    modes: ["dark"],
    variants: {
      dark: {
        theme: {
          colors: { canvas: "#111111", text: "#222222" },
        },
      },
    },
  });
  const buffer = storedZip([["appearance.json", manifest]]);
  await page
    .locator('input[accept=".tnlook,.zip"]')
    .setInputFiles({
      name: "low-contrast.tnlook",
      mimeType: "application/zip",
      buffer,
    });

  await expect(page.locator(".theme-pack-warnings")).toContainText(
    "对比度",
  );
  await expect(
    page.getByRole("button", { name: "应用外观" }),
  ).toBeVisible();
});

test("disables a plugin from the plugin manager", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();
  await page.getByRole("button", { name: /主题/ }).click();
  await page.getByRole("button", { name: "外观设置…" }).click();
  await page.getByRole("button", { name: "插件", exact: true }).click();

  const helpRow = page
    .locator(".plugin-manager-list li")
    .filter({ hasText: "help" });
  await expect(helpRow).toBeVisible();
  await helpRow.getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "重新加载以应用" }).click();
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "帮助", exact: true }),
  ).toHaveCount(0);
});

test("imports and validates an appearance pack", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();
  await page.getByRole("button", { name: /主题/ }).click();
  await page.getByRole("button", { name: "导入外观包…" }).click();

  const manifest = JSON.stringify({
    schema: 1,
    id: "e2e-pack",
    name: "E2E 外观",
    version: "1.0.0",
    modes: ["dark"],
    variants: {
      dark: {
        theme: { colors: { accent: "#ff5ecb" } },
        skin: {
          background: { image: "assets/wallpaper.webp" },
          surfaces: {
            dialog: {
              background: "rgba(1,2,3,0.5)",
              blur: 20,
            },
            panel: {
              background: "rgba(12,18,40,0.72)",
              blur: 16,
            },
          },
          decorations: [
            {
              src: "assets/decoration.png",
              anchor: "bottom-left",
              width: "22vw",
              opacity: 0.8,
              hideBelow: 900,
            },
          ],
        },
      },
    },
  });
  const buffer = storedZip([
    ["appearance.json", manifest],
    ["assets/wallpaper.webp", "fake-image"],
    ["assets/decoration.png", "fake-decoration"],
  ]);
  await page
    .locator('input[accept=".tnlook,.zip"]')
    .setInputFiles({
      name: "e2e.tnlook",
      mimeType: "application/zip",
      buffer,
    });

  await expect(
    page.getByText(/已校验：E2E 外观（2 个资源）.*/),
  ).toBeVisible();
  await expect(
    page.getByLabel("外观包预览"),
  ).toBeVisible();
  await expect(
    page.getByLabel("外观包预览"),
  ).toHaveAttribute("data-wallpaper", "true");
  await expect(
    page.locator(".appearance-preview-decoration"),
  ).toHaveCount(1);

  await page.getByRole("button", { name: "应用外观" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-appearance-pack",
    "e2e-pack",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--accent"),
      ),
    )
    .toBe("#ff5ecb");
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--app-wallpaper"),
      ),
    )
    .toContain("blob:");
  await expect(page.locator(".appearance-decoration")).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue(
          "--surface-dialog-blur",
        ),
      ),
    )
    .toBe("20px");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const panel = document.querySelector(".dv-groupview");
        return panel ? getComputedStyle(panel).backdropFilter : "";
      }),
    )
    .toContain("blur(16px)");
  await page.waitForTimeout(200);

  await page.reload();
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-appearance-pack",
    "e2e-pack",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--accent"),
      ),
    )
    .toBe("#ff5ecb");
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--app-wallpaper"),
      ),
    )
    .toContain("blob:");
  await expect(page.locator(".appearance-decoration")).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue(
          "--surface-dialog-blur",
        ),
      ),
    )
    .toBe("20px");

  await page.getByRole("button", { name: /主题/ }).click();
  await expect(page.getByText("已应用外观包")).toBeVisible();
  await page.getByRole("button", { name: "回退外观" }).click();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-appearance-pack",
    /.*/,
  );
});

test("switches appearance pack variants with the theme mode", async ({
  page,
}) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();
  await page.getByRole("button", { name: "主题", exact: true }).click();
  await page.getByRole("button", { name: "导入外观包…" }).click();

  const manifest = JSON.stringify({
    schema: 1,
    id: "e2e-variants",
    name: "双模式外观",
    version: "1.0.0",
    modes: ["dark", "light"],
    variants: {
      dark: {
        theme: { colors: { accent: "#112233" } },
        skin: {
          background: { image: "assets/dark.webp" },
          decorations: [],
        },
      },
      light: {
        theme: { colors: { accent: "#ddeeff" } },
        skin: {
          background: { image: "assets/light.webp" },
          decorations: [],
        },
      },
    },
  });
  const buffer = storedZip([
    ["appearance.json", manifest],
    ["assets/dark.webp", "dark-image"],
    ["assets/light.webp", "light-image"],
  ]);
  await page
    .locator('input[accept=".tnlook,.zip"]')
    .setInputFiles({
      name: "e2e-variants.tnlook",
      mimeType: "application/zip",
      buffer,
    });
  await page.getByRole("button", { name: "应用外观" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--accent"),
      ),
    )
    .toBe("#112233");
  await expect(page.locator("html")).toHaveAttribute(
    "data-appearance-mode",
    "dark",
  );

  await page.getByRole("button", { name: "浅色" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--accent"),
      ),
    )
    .toBe("#ddeeff");
  await expect(page.locator("html")).toHaveAttribute(
    "data-appearance-mode",
    "light",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-appearance-pack",
    "e2e-variants",
  );

  await page.reload();
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--accent"),
      ),
    )
    .toBe("#ddeeff");
  await expect(page.locator("html")).toHaveAttribute(
    "data-appearance-mode",
    "light",
  );

  await page.getByRole("button", { name: "主题", exact: true }).click();
  await page.getByRole("button", { name: "深色" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--accent"),
      ),
    )
    .toBe("#112233");
});

test("hides appearance decorations on narrow windows", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();
  await page.getByRole("button", { name: /主题/ }).click();
  await page.getByRole("button", { name: "导入外观包…" }).click();

  const manifest = JSON.stringify({
    schema: 1,
    id: "e2e-narrow",
    name: "窄屏外观",
    version: "1.0.0",
    modes: ["dark"],
    variants: {
      dark: {
        theme: { colors: { accent: "#ff5ecb" } },
        skin: {
          decorations: [
            {
              src: "assets/decoration.png",
              anchor: "bottom-left",
              width: "22vw",
              opacity: 1,
              hideBelow: 900,
            },
          ],
        },
      },
    },
  });
  const buffer = storedZip([
    ["appearance.json", manifest],
    ["assets/decoration.png", "fake-decoration"],
  ]);
  await page
    .locator('input[accept=".tnlook,.zip"]')
    .setInputFiles({
      name: "e2e-narrow.tnlook",
      mimeType: "application/zip",
      buffer,
    });

  await page.getByRole("button", { name: "应用外观" }).click();
  await expect(page.locator(".appearance-decoration")).toHaveCount(0);
});

test("switches shell profile at mobile breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto("/e2e.html");
  await expect(page.locator(".app")).toHaveAttribute(
    "data-shell",
    "mobile",
  );
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(page.locator(".app")).toHaveAttribute(
    "data-shell",
    "desktop",
  );
});

test("renders the mobile shell and opens documents", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto("/e2e.html");
  await expect(page.locator(".mobile-shell")).toBeVisible();
  await expect(page.getByRole("button", { name: "导图" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "导图" }),
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "目录", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "目录", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("测试想法").first()).toBeVisible();
  await page
    .getByRole("button", { name: /测试想法/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "文档", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText("测试文档").first()).toBeVisible();

  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(page.locator(".ProseMirror")).toBeVisible();
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("移动端编辑");
  await page
    .locator(".mobile-document-actions")
    .getByRole("button", { name: "保存", exact: true })
    .click();
  await expect(page.getByText("已保存")).toBeVisible();
  await page
    .locator(".mobile-document-actions")
    .getByRole("button", { name: "完成", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "编辑", exact: true })).toBeVisible();

  await page
    .getByLabel("移动导航")
    .getByRole("button", { name: "设置", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "设置" })).toBeVisible();
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

  await page.getByRole("button", { name: /主题/ }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTitle("导出外观包").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.tnlook$/);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-mode",
    /^custom:/,
  );
});

test("opens the board with the keyboard shortcut", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();
  await expect(page.locator(".dv-tab").first()).toBeVisible();

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

  await page.getByRole("button", { name: "视图", exact: true }).click();
  await page.getByRole("button", { name: "控制台" }).click();
  await expect(page.locator(".console-panel")).toBeVisible();
});

test("opens the knowledge menu", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();

  await page.getByRole("button", { name: "知识库", exact: true }).click();
  await expect(page.getByRole("button", { name: "新建知识库…" })).toBeVisible();
  await expect(page.getByRole("button", { name: "打开知识库…" })).toBeVisible();
  await expect(page.getByRole("button", { name: "保存" })).toBeVisible();
});

test("closes the knowledge menu on outside click", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();

  await page.getByRole("button", { name: "知识库", exact: true }).click();
  await expect(page.getByRole("button", { name: "新建知识库…" })).toBeVisible();

  await page.locator(".dock-fill").click({ position: { x: 40, y: 40 } });
  await expect(
    page.getByRole("button", { name: "新建知识库…" }),
  ).toHaveCount(0);
});

test("closes the theme menu on outside click and Escape", async ({
  page,
}) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();

  await page.getByRole("button", { name: "主题", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "新建主题…" }),
  ).toBeVisible();
  await page.locator(".dock-fill").click({ position: { x: 40, y: 40 } });
  await expect(
    page.getByRole("button", { name: "新建主题…" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "主题", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "新建主题…" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "新建主题…" }),
  ).toHaveCount(0);
});

test("opens the help knowledge base from the toolbar", async ({ page }) => {
  await page.goto("/e2e.html");
  await expect(page.getByText(/演示知识库/).first()).toBeVisible();

  const help = page.getByRole("button", { name: "帮助" });
  await expect(help).toHaveCSS("border-top-width", "0px");
  await help.click();
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

