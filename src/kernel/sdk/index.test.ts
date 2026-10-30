import { describe, expect, it } from "vitest";
import {
  PLUGIN_SDK_VERSION,
  validatePluginManifest,
  type PluginManifest,
} from "./index";

describe("plugin SDK", () => {
  it("exposes a stable version and manifest validation", () => {
    expect(PLUGIN_SDK_VERSION).toBe(1);
    const manifest: PluginManifest = {
      schema: 1,
    sdkVersion: 1,
      id: "sample",
      name: "Sample",
      version: "1.0.0",
      kind: "feature",
      provides: ["sample"],
      dependencies: [],
      capabilities: [],
      contributes: {},
    };
    expect(validatePluginManifest(manifest)).toEqual([]);
  });
});
