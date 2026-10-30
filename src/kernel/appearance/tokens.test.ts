import { describe, expect, it } from "vitest";
import {
  resolvePackOverrides,
  resolveSurfaceOverrides,
} from "./tokens";

describe("appearance token mapping", () => {
  it("maps known colors to CSS variables", () => {
    expect(
      resolvePackOverrides({
        accent: "#ff5ecb",
        canvas: "#080d20",
        panel: "#141b38",
        unknownKey: "#000",
      }),
    ).toEqual({
      "--accent": "#ff5ecb",
      "--bg": "#080d20",
      "--bg-panel": "#141b38",
    });
  });

  it("maps surface fields to surface variables", () => {
    expect(
      resolveSurfaceOverrides({
        panel: {
          background: "rgba(12,18,40,0.72)",
          blur: 16,
          border: "rgba(150,170,255,0.18)",
          radius: 14,
          shadow: "0 18px 50px rgba(0,0,0,0.35)",
        },
      }),
    ).toEqual({
      "--surface-panel-bg": "rgba(12,18,40,0.72)",
      "--surface-panel-blur": "16px",
      "--surface-panel-border": "rgba(150,170,255,0.18)",
      "--surface-panel-radius": "14",
      "--surface-panel-shadow": "0 18px 50px rgba(0,0,0,0.35)",
    });
  });
});
