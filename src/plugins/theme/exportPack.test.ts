import { describe, expect, it } from "vitest";
import { readAppearancePack } from "./appearanceZip";
import {
  themeAppearancePackBytes,
  themeToAppearancePack,
} from "./exportPack";
import type { ThemeManifest } from "../../ui/sdk";

const theme: ThemeManifest = {
  schema: 1,
  id: "my-theme",
  name: "我的主题",
  base: "dark",
  tokens: {
    "--bg": "#101010",
    "--bg-panel": "#181818",
    "--text": "#f5f5f5",
    "--muted": "#a0a0a0",
    "--accent": "#ff5ecb",
    "--border": "#303030",
  },
};

describe("appearance pack export", () => {
  it("maps theme tokens to pack colors", () => {
    const pack = themeToAppearancePack(theme);
    expect(pack.id).toBe("my-theme");
    expect(pack.modes).toEqual(["dark"]);
    expect(pack.variants.dark?.theme?.colors).toMatchObject({
      canvas: "#101010",
      panel: "#181818",
      text: "#f5f5f5",
      textMuted: "#a0a0a0",
      accent: "#ff5ecb",
      border: "#303030",
    });
  });

  it("writes a zip that the pack reader accepts", async () => {
    const bytes = themeAppearancePackBytes(theme);
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const result = await readAppearancePack(buffer);
    expect(result.error).toBeUndefined();
    expect(result.pack?.id).toBe("my-theme");
    expect(result.assets).toEqual([]);
  });
});
