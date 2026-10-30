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
});
