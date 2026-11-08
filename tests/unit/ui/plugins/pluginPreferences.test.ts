import { beforeEach, describe, expect, it } from "vitest";
import {
  isPluginDisabled,
  readDisabledPlugins,
  setPluginDisabled,
} from "../../../../src/ui/plugins/pluginPreferences";

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

  it("treats every plugin id uniformly", () => {
    setPluginDisabled("manager", true);
    expect(isPluginDisabled("manager")).toBe(true);
    expect(readDisabledPlugins().has("manager")).toBe(true);
    setPluginDisabled("manager", false);
    expect(isPluginDisabled("manager")).toBe(false);
  });
});
