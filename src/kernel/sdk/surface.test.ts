import { describe, expect, it } from "vitest";
import * as sdk from "./index";

/**
 * The plugin SDK is the only kernel surface features may import.
 * Adding a runtime export is a public API change: update this list
 * deliberately and bump PLUGIN_SDK_VERSION when semantics change.
 */
const EXPORTED_SURFACE = [
  "APP_EVENTS",
  "CONTRIBUTION_KINDS",
  "CORE_CAPABILITIES",
  "PLUGIN_SDK_VERSION",
  "PluginRegistry",
  "SURFACE_TOKEN_GROUPS",
  "THEME_COLOR_TOKENS",
  "commandEventName",
  "contrastRatio",
  "contrastWarnings",
  "createPluginHost",
  "dispatchCommandEvent",
  "emitAppEvent",
  "getPanelDefinitions",
  "getUiRenderer",
  "hasUiRenderer",
  "onAppEvent",
  "registerIntentHandler",
  "registerPanel",
  "registerUiRenderer",
  "resolvePackOverrides",
  "resolveSurfaceOverrides",
  "unregisterPanel",
  "unregisterUiRenderer",
  "validatePluginManifest",
];

describe("plugin SDK surface", () => {
  it("exports only the approved runtime surface", () => {
    expect(Object.keys(sdk).sort()).toEqual(EXPORTED_SURFACE);
  });
});
