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
});
