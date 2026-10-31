import { beforeEach, describe, expect, it } from "vitest";
import {
  isPluginDisabled,
  readDisabledPlugins,
  setPluginDisabled,
} from "./pluginPreferences";

beforeEach(() => {
  window.localStorage.clear();
});

describe("plugin preferences", () => {
  it("persists disabled plugin ids", () => {
    expect(readDisabledPlugins().size).toBe(0);
    setPluginDisabled("help", true);
    expect(isPluginDisabled("help")).toBe(true);
    setPluginDisabled("help", false);
    expect(isPluginDisabled("help")).toBe(false);
  });

  it("never disables the plugin manager", () => {
    setPluginDisabled("manager", true);
    expect(isPluginDisabled("manager")).toBe(false);
    expect(readDisabledPlugins().has("manager")).toBe(false);
  });

  it("ignores stale manager entries in storage", () => {
    window.localStorage.setItem(
      "tauri-notes.disabled-plugins.v1",
      JSON.stringify(["manager", "help"]),
    );
    expect(isPluginDisabled("manager")).toBe(false);
    expect(isPluginDisabled("help")).toBe(true);
  });
});
