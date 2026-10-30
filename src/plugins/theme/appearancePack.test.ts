import { describe, expect, it } from "vitest";
import { validateAppearancePack } from "./appearancePack";

function pack(overrides: Record<string, unknown> = {}) {
  return {
    schema: 1,
    id: "starry-glass",
    name: "星空玻璃",
    version: "1.0.0",
    modes: ["dark", "light"],
    variants: {
      dark: { theme: { colors: { accent: "#ff5ecb" } } },
      light: { theme: { colors: { accent: "#8a4dff" } } },
    },
    ...overrides,
  };
}

describe("appearance pack schema", () => {
  it("accepts a valid pack", () => {
    expect(validateAppearancePack(pack()).pack?.id).toBe("starry-glass");
  });

  it("reports low contrast colors as warnings", () => {
    const result = validateAppearancePack(
      pack({
        variants: {
          dark: {
            theme: {
              colors: { canvas: "#111111", text: "#222222" },
            },
          },
          light: { theme: { colors: { accent: "#8a4dff" } } },
        },
      }),
    );
    expect(result.pack?.id).toBe("starry-glass");
    expect(result.warnings?.[0]).toContain("对比度");
  });

  it("validates integrity entries", () => {
    expect(
      validateAppearancePack(
        pack({
          integrity: {
            "assets/wallpaper.webp":
              "sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=",
          },
        }),
      ).error,
    ).toBeUndefined();
    expect(
      validateAppearancePack(
        pack({ integrity: { "assets/wallpaper.webp": "sha256-nope" } }),
      ).error,
    ).toContain("integrity 格式");
    expect(
      validateAppearancePack(
        pack({ integrity: { "../secret": "sha256-nope" } }),
      ).error,
    ).toContain("不安全");
  });

  it("rejects missing variants and unsafe paths", () => {
    expect(
      validateAppearancePack(pack({ modes: ["dark", "light"], variants: {} }))
        .error,
    ).toContain("variant");
    expect(
      validateAppearancePack(
        pack({
          variants: {
            dark: { skin: { background: { image: "../secret.png" } } },
            light: {},
          },
        }),
      ).error,
    ).toContain("不安全");
  });
});
