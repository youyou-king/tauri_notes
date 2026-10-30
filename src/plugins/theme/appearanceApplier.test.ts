import { beforeEach, describe, expect, it } from "vitest";
import {
  appliedAppearancePackId,
  applyAppearanceColors,
  getAppliedDecorations,
  restoreAppliedAppearance,
  rollbackAppearance,
} from "./appearanceApplier";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.style.removeProperty("--accent");
  document.documentElement.removeAttribute("data-appearance-pack");
  rollbackAppearance();
});

describe("appearance applier", () => {
  it("applies and rolls back CSS variables", () => {
    document.documentElement.style.setProperty("--accent", "#000000");
    applyAppearanceColors("starry-glass", { accent: "#ff5ecb" });

    expect(appliedAppearancePackId()).toBe("starry-glass");
    expect(
      document.documentElement.style.getPropertyValue("--accent"),
    ).toBe("#ff5ecb");

    rollbackAppearance();
    expect(appliedAppearancePackId()).toBeNull();
    expect(
      document.documentElement.style.getPropertyValue("--accent"),
    ).toBe("#000000");
  });

  it("applies and rolls back the wallpaper variable", () => {
    applyAppearanceColors("starry-glass", {}, {
      wallpaperUrl: "blob:wallpaper",
    });
    expect(
      document.documentElement.style.getPropertyValue("--app-wallpaper"),
    ).toContain("blob:wallpaper");

    rollbackAppearance();
    expect(
      document.documentElement.style.getPropertyValue("--app-wallpaper"),
    ).toBe("");
  });

  it("applies surface overrides", () => {
    applyAppearanceColors("starry-glass", {}, {
      surfaces: {
        dialog: { background: "rgba(1,2,3,0.5)", blur: 20 },
      },
    });
    expect(
      document.documentElement.style.getPropertyValue(
        "--surface-dialog-bg",
      ),
    ).toBe("rgba(1,2,3,0.5)");
    expect(
      document.documentElement.style.getPropertyValue(
        "--surface-dialog-blur",
      ),
    ).toBe("20px");

    rollbackAppearance();
    expect(
      document.documentElement.style.getPropertyValue(
        "--surface-dialog-bg",
      ),
    ).toBe("");
  });

  it("keeps and clears applied decorations", () => {
    applyAppearanceColors("starry-glass", {}, {
      decorations: [
        {
          src: "blob:decoration",
          anchor: "bottom-left",
          width: "22vw",
          opacity: 0.8,
        },
      ],
    });
    expect(getAppliedDecorations()).toHaveLength(1);

    rollbackAppearance();
    expect(getAppliedDecorations()).toHaveLength(0);
  });

  it("restores the applied appearance from storage", async () => {
    window.localStorage.setItem(
      "tauri-notes.appearance-pack.v1",
      JSON.stringify({
        packId: "starry-glass",
        colors: { accent: "#ff5ecb" },
      }),
    );
    expect(await restoreAppliedAppearance()).toBe(true);
    expect(appliedAppearancePackId()).toBe("starry-glass");
    expect(
      document.documentElement.style.getPropertyValue("--accent"),
    ).toBe("#ff5ecb");
  });
});
