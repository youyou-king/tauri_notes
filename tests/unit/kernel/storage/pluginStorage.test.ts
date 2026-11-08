import { beforeEach, describe, expect, it } from "vitest";
import { createPluginStorage } from "../../../../src/kernel/storage/pluginStorage";

beforeEach(() => {
  window.localStorage.clear();
});

describe("plugin storage port", () => {
  it("namespaces keys by plugin", () => {
    const storage = createPluginStorage("theme");
    storage.set("appearance", "dark");
    expect(
      window.localStorage.getItem("tauri-notes.plugin.theme.appearance"),
    ).toBe("dark");
    expect(storage.get("appearance")).toBe("dark");
  });

  it("ignores data outside the plugin namespace", () => {
    window.localStorage.setItem("tauri-notes.appearance-pack.v1", "legacy");
    const storage = createPluginStorage("theme");
    expect(storage.get("appearance-pack.v1")).toBeNull();
  });

  it("reads and writes JSON", () => {
    const storage = createPluginStorage("theme");
    storage.setJSON("preferences", ["a", "b"]);
    expect(storage.getJSON("preferences", [])).toEqual(["a", "b"]);
    expect(storage.getJSON("missing", ["fallback"])).toEqual(["fallback"]);
  });
});
