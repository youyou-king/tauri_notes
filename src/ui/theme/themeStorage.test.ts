import { describe, expect, it } from "vitest";
import {
  THEME_STORAGE_KEY,
  readThemeSelection,
  writeThemeSelection,
} from "./themeStorage";

function storage(raw: string | null) {
  return {
    getItem: (key: string) => (key === THEME_STORAGE_KEY ? raw : null),
    setItem: () => {},
  };
}

describe("themeStorage", () => {
  it("reads legacy bare selections", () => {
    expect(readThemeSelection(storage("dark"))).toBe("dark");
    expect(readThemeSelection(storage("custom:paper"))).toBe("custom:paper");
  });

  it("reads versioned selections", () => {
    expect(
      readThemeSelection(
        storage(JSON.stringify({ version: 2, selection: "light" })),
      ),
    ).toBe("light");
  });

  it("falls back for malformed or future data", () => {
    expect(readThemeSelection(storage("{broken"))).toBe("dark");
    expect(
      readThemeSelection(
        storage(JSON.stringify({ version: 3, selection: "light" })),
      ),
    ).toBe("dark");
  });

  it("writes a versioned envelope", () => {
    let written = "";
    writeThemeSelection("system", {
      setItem: (_key, value) => {
        written = value;
      },
    });
    expect(JSON.parse(written)).toEqual({
      version: 2,
      selection: "system",
    });
  });
});
