import { beforeEach, describe, expect, it } from "vitest";
import {
  CUSTOM_THEMES_KEY,
  loadCustomThemes,
  parseThemeManifest,
  saveCustomThemes,
} from "./themeSchema";

const valid = {
  schema: 1,
  id: "ocean",
  name: "深海蓝",
  base: "dark",
  tokens: {
    "--bg": "#0b1020",
    "--accent": "#58a6ff",
  },
};

describe("themeSchema", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("accepts a valid theme", () => {
    const result = parseThemeManifest(valid);
    expect(result.error).toBeUndefined();
    expect(result.theme?.id).toBe("ocean");
    expect(result.theme?.tokens["--bg"]).toBe("#0b1020");
  });

  it("rejects invalid ids and bases", () => {
    expect(parseThemeManifest({ ...valid, id: "Ocean Theme" }).error).toBeTruthy();
    expect(parseThemeManifest({ ...valid, base: "blue" }).error).toBeTruthy();
  });

  it("rejects unsafe token values", () => {
    const result = parseThemeManifest({
      ...valid,
      tokens: { "--bg": "url(https://example.com/x.png)" },
    });
    expect(result.error).toBeTruthy();
  });

  it("rejects selector injection in token values", () => {
    const result = parseThemeManifest({
      ...valid,
      tokens: { "--bg": "red; } body { display: none" },
    });
    expect(result.error).toBeTruthy();
  });

  it("round-trips custom themes", () => {
    const parsed = parseThemeManifest(valid).theme!;
    saveCustomThemes([parsed]);
    expect(loadCustomThemes()).toEqual([parsed]);
    expect(window.localStorage.getItem(CUSTOM_THEMES_KEY)).toBeTruthy();
  });

  it("ignores corrupt storage", () => {
    window.localStorage.setItem(CUSTOM_THEMES_KEY, "{broken");
    expect(loadCustomThemes()).toEqual([]);
  });
});
