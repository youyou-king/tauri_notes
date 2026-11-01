import { beforeEach, describe, expect, it } from "vitest";
import { createPluginStorage } from "./pluginStorage";

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

  it("migrates legacy unprefixed keys", () => {
    window.localStorage.setItem("tauri-notes.appearance-pack.v1", "legacy");
    const storage = createPluginStorage("theme");
    expect(storage.get("appearance-pack.v1")).toBe("legacy");
    expect(
      window.localStorage.getItem(
        "tauri-notes.plugin.theme.appearance-pack.v1",
      ),
    ).toBe("legacy");
    expect(
      window.localStorage.getItem("tauri-notes.appearance-pack.v1"),
    ).toBeNull();
  });

  it("reads and writes JSON", () => {
    const storage = createPluginStorage("theme");
    storage.setJSON("trusted", ["a", "b"]);
    expect(storage.getJSON("trusted", [])).toEqual(["a", "b"]);
    expect(storage.getJSON("missing", ["fallback"])).toEqual(["fallback"]);
  });
});
