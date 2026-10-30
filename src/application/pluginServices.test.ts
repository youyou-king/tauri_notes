import { describe, expect, it } from "vitest";
import {
  assertPluginCapability,
  createPluginServices,
} from "./pluginServices";
import type { PluginManifest } from "../kernel/plugin";

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
    expect(() => services.document.list("workspace")).toThrow(
      "document.read",
    );
    expect(() => services.assets.saveImage({
      workspace: "w",
      documentId: "d",
      fileName: "a.png",
      bytes: [],
      noteFile: false,
    })).toThrow("fs.write");
    expect(() => services.reference.listTargets("w")).toThrow(
      "reference.read",
    );
    expect(() =>
      services.reference.relink("w", "r", "d", "b"),
    ).toThrow("reference.write");
  });
});
