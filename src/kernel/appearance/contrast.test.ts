import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  contrastWarnings,
  parseColor,
} from "./contrast";

describe("contrast", () => {
  it("parses hex and rgb colors", () => {
    expect(parseColor("#fff")).toEqual([255, 255, 255]);
    expect(parseColor("#000000")).toEqual([0, 0, 0]);
    expect(parseColor("rgb(255, 0, 0)")).toEqual([255, 0, 0]);
    expect(parseColor("not-a-color")).toBeNull();
  });

  it("computes WCAG contrast ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("warns about low contrast pairs", () => {
    const warnings = contrastWarnings({
      canvas: "#111111",
      panel: "#111111",
      text: "#222222",
      textMuted: "#333333",
      accent: "#444444",
    });
    expect(warnings.some((warning) => warning.includes("正文/画布"))).toBe(
      true,
    );
    expect(
      contrastWarnings({
        canvas: "#000000",
        panel: "#111111",
        text: "#ffffff",
        textMuted: "#cccccc",
        accent: "#ff5ecb",
      }),
    ).toEqual([]);
  });
});
