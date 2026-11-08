import { describe, expect, it } from "vitest";
import {
  assertPluginCapability,
  createPluginServices,
} from "../../../src/application/pluginServices";
import type { PluginManifest } from "../../../src/kernel/plugin";

function manifest(capabilities: string[]): PluginManifest {
  return {
    schema: 1,
    sdkVersion: 1,
    id: "test",
    name: "Test",
    version: "1.0.0",
    kind: "feature",
    provides: ["test"],
    dependencies: [],
    capabilities,
  };
}

describe("plugin services", () => {
  it("throws when a capability is missing", () => {
    expect(() =>
      assertPluginCapability(manifest([]), "document.read"),
    ).toThrow("缺少能力 document.read");
    expect(() =>
      assertPluginCapability(
        manifest(["document.read"]),
        "document.read",
      ),
    ).not.toThrow();
  });

  it("guards service calls before invoking the service", () => {
    const services = createPluginServices(manifest([]));
    expect(() => services.document.list("lib_workspace")).toThrow(
      "document.read",
    );
    expect(() => services.assets.saveImage({
      libraryId: "lib_w",
      documentId: "d",
      fileName: "a.png",
      bytes: [],
      noteFile: false,
    })).toThrow("fs.write");
    expect(() => services.reference.listTargets("lib_w")).toThrow(
      "reference.read",
    );
    expect(() =>
      services.reference.relink("lib_w", "r", "d", "b"),
    ).toThrow("reference.write");
  });
});
