import { describe, expect, it } from "vitest";
import { readAppearanceAsset, readAppearancePack } from "./appearanceZip";

function storedZip(files: Array<[string, string]>): ArrayBuffer {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let localOffset = 0;
  for (const [path, content] of files) {
    const name = encoder.encode(path);
    const data = encoder.encode(content);
    const local = new Uint8Array(30 + name.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centrals.push(central);
    localOffset += local.length;
  }

  const centralOffset = localOffset;
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, centralOffset, true);

  const total =
    locals.reduce((sum, part) => sum + part.length, 0) +
    centralSize +
    eocd.length;
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    output.set(part, offset);
    offset += part.length;
  }
  return output.buffer;
}

const validManifest = JSON.stringify({
  schema: 1,
  id: "starry-glass",
  name: "星空玻璃",
  version: "1.0.0",
  modes: ["dark"],
  variants: { dark: { theme: { colors: { accent: "#ff5ecb" } } } },
});

describe("appearance pack zip", () => {
  it("reads appearance.json from a stored zip", async () => {
    const result = await readAppearancePack(
      storedZip([
        ["appearance.json", validManifest],
        ["assets/wallpaper.webp", "fake"],
      ]),
    );
    expect(result.error).toBeUndefined();
    expect(result.pack?.id).toBe("starry-glass");
    expect(result.assets).toContain("assets/wallpaper.webp");
  });

  it("extracts asset bytes", async () => {
    const buffer = storedZip([
      ["appearance.json", validManifest],
      ["assets/wallpaper.webp", "wallpaper"],
    ]);
    const bytes = await readAppearanceAsset(buffer, "assets/wallpaper.webp");
    expect(new TextDecoder().decode(bytes ?? new Uint8Array())).toBe(
      "wallpaper",
    );
  });

  it("rejects missing manifest and traversal paths", async () => {
    const missing = await readAppearancePack(
      storedZip([["preview.webp", "x"]]),
    );
    expect(missing.error).toContain("appearance.json");
    const traversal = await readAppearancePack(
      storedZip([
        ["appearance.json", validManifest],
        ["../secret", "x"],
      ]),
    );
    expect(traversal.error).toContain("非法资源路径");
  });

  it("rejects integrity entries without assets", async () => {
    const manifest = JSON.stringify({
      schema: 1,
      id: "integrity-pack",
      name: "Integrity",
      version: "1.0.0",
      modes: ["dark"],
      integrity: {
        "assets/missing.webp":
          "sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=",
      },
      variants: { dark: {} },
    });
    const result = await readAppearancePack(
      storedZip([["appearance.json", manifest]]),
    );
    expect(result.error).toContain("完整性清单缺少资源");
  });
});
