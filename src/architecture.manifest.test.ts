import { describe, expect, it } from "vitest";
import {
  PLUGIN_SDK_VERSION,
  validatePluginManifest,
  type PluginManifest,
} from "./kernel/plugin";
import rustPluginApi from "../src-tauri/crates/plugin-api/src/lib.rs?raw";

const manifests = import.meta.glob("./plugins/**/feature.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function parsed(): Array<{ file: string; manifest: PluginManifest }> {
  return Object.entries(manifests).map(([file, raw]) => ({
    file,
    manifest: JSON.parse(raw) as PluginManifest,
  }));
}

describe("feature plugin contracts", () => {
  it("has at least one feature manifest", () => {
    expect(parsed().length).toBeGreaterThan(5);
  });

  it("validates every feature manifest", () => {
    const failures = parsed().flatMap(({ file, manifest }) =>
      validatePluginManifest(manifest).map((error) => `${file}: ${error}`),
    );
    expect(failures).toEqual([]);
  });

  it("keeps SDK versions in sync", () => {
    for (const { file, manifest } of parsed()) {
      expect(manifest.sdkVersion, file).toBe(PLUGIN_SDK_VERSION);
    }
    const rustVersion = rustPluginApi.match(
      /pub const SDK_VERSION: u32 = (\d+);/,
    );
    expect(rustVersion?.[1]).toBe(String(PLUGIN_SDK_VERSION));
  });

  it("keeps ids unique and aligned with folders", () => {
    const ids = new Set<string>();
    for (const { file, manifest } of parsed()) {
      expect(ids.has(manifest.id), file).toBe(false);
      ids.add(manifest.id);
      expect(file).toContain(`/plugins/${manifest.id}/feature.json`);
    }
  });
});
