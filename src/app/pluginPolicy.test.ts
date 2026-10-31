import { describe, expect, it } from "vitest";
import { PluginRegistry, type PluginManifest } from "../kernel/plugin";
import { PLUGIN_CAPABILITY_POLICY } from "../plugins/pluginPolicy";
import { PLUGIN_ENTRIES } from "../plugins/registry";

describe("plugin capability policy", () => {
  it("declares an explicit policy for every registered plugin", () => {
    for (const entry of PLUGIN_ENTRIES) {
      const allowed = PLUGIN_CAPABILITY_POLICY[entry.manifest.id];
      expect(allowed, `missing policy for ${entry.manifest.id}`).toBeDefined();
      for (const capability of entry.manifest.capabilities) {
        expect(allowed).toContain(capability);
      }
    }
  });

  it("rejects a capability that is not in the build policy", async () => {
    const manifest: PluginManifest = {
      schema: 1,
      sdkVersion: 1,
      id: "theme",
      name: "theme",
      version: "1.0.0",
      kind: "feature",
      provides: ["theme"],
      dependencies: [],
      capabilities: ["fs.write"],
    };
    const registry = new PluginRegistry({
      capabilityPolicy: PLUGIN_CAPABILITY_POLICY,
    });
    registry.registerEntrySafely(manifest, () => ({
      activate: () => {},
    }));
    const failures = await registry.startSafely();
    expect(failures).toContainEqual(
      expect.objectContaining({
        pluginId: "theme",
        kind: "registration",
      }),
    );
    await registry.stop();
  });
});
