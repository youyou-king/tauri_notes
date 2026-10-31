import { describe, expect, it } from "vitest";
import { createPluginHost } from "./assembly";
import type { PluginManifest, PluginModule } from "./contracts";

function manifest(id: string): PluginManifest {
  return {
    schema: 1,
    sdkVersion: 1,
    id,
    name: id,
    version: "1.0.0",
    kind: "feature",
    provides: [id],
    dependencies: [],
    capabilities: [],
  };
}

describe("plugin host assembly", () => {
  it("assembles entries into a working registry", async () => {
    const activated: string[] = [];
    const module = (id: string): PluginModule => ({
      activate: () => {
        activated.push(id);
      },
    });
    const host = createPluginHost([
      { manifest: manifest("board"), createModule: () => module("board") },
      {
        manifest: manifest("reference"),
        createModule: () => module("reference"),
      },
    ]);

    await host.start();
    expect(activated).toEqual(["board", "reference"]);
    await host.stop();
  });

  it("turns invalid manifests into diagnostics instead of startup crashes", async () => {
    const host = createPluginHost([
      {
        manifest: { ...manifest("bad"), name: "" } as PluginManifest,
        createModule: () => ({ activate: () => {} }),
      },
      {
        manifest: manifest("good"),
        createModule: () => ({ activate: () => {} }),
      },
    ]);

    const failures = await host.startSafely();
    expect(failures).toContainEqual(
      expect.objectContaining({
        pluginId: "bad",
        kind: "registration",
      }),
    );
    await host.stop();
  });

  it("turns module factory errors into diagnostics", async () => {
    const host = createPluginHost([
      {
        manifest: manifest("broken"),
        createModule: () => {
          throw new Error("module unavailable");
        },
      },
    ]);

    const failures = await host.startSafely();
    expect(failures).toContainEqual(
      expect.objectContaining({
        pluginId: "broken",
        kind: "registration",
      }),
    );
    await host.stop();
  });
});
