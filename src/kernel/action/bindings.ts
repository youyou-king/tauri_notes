import type {
  ActionBinding,
  InputPlatform,
} from "./types";

/**
 * Default bindings are intentionally data, not command metadata. A future
 * keymap.toml replaces the user-overridable portion of this table.
 */
export const DEFAULT_BINDINGS: Record<string, ActionBinding[]> = {
  "settings.open": [
    {
      kind: "key",
      platform: "desktop",
      key: ",",
      ctrl: true,
      scope: "global",
    },
    {
      kind: "key",
      platform: "mac",
      key: ",",
      meta: true,
      scope: "global",
    },
    {
      kind: "surface",
      platform: "mobile",
      surface: "settings.open",
      scope: "mobile",
    },
  ],
  "search.open": [
    {
      kind: "key",
      platform: "desktop",
      key: "p",
      ctrl: true,
      scope: "global",
    },
    {
      kind: "key",
      platform: "mac",
      key: "p",
      meta: true,
      scope: "global",
    },
    {
      kind: "surface",
      platform: "mobile",
      surface: "search.open",
      scope: "mobile",
    },
  ],
  "board.open": [
    {
      kind: "key",
      platform: "desktop",
      key: "b",
      ctrl: true,
      shift: true,
      scope: "global",
    },
    {
      kind: "key",
      platform: "mac",
      key: "b",
      meta: true,
      shift: true,
      scope: "global",
    },
    {
      kind: "surface",
      platform: "mobile",
      surface: "board.open",
      scope: "mobile",
    },
  ],
  "theme.open": [
    {
      kind: "key",
      platform: "desktop",
      key: "t",
      ctrl: true,
      shift: true,
      scope: "global",
    },
    {
      kind: "key",
      platform: "mac",
      key: "t",
      meta: true,
      shift: true,
      scope: "global",
    },
    {
      kind: "surface",
      platform: "mobile",
      surface: "theme.open",
      scope: "mobile",
    },
  ],
  "help.open": [
    {
      kind: "surface",
      platform: "mobile",
      surface: "help.open",
      scope: "mobile",
    },
  ],
  "viewport.pick": [
    {
      kind: "key",
      platform: "desktop",
      key: "v",
      ctrl: true,
      alt: true,
      scope: "global",
    },
    {
      kind: "key",
      platform: "mac",
      key: "v",
      meta: true,
      alt: true,
      scope: "global",
    },
  ],
};

export function resolveInputPlatform(
  userAgent: string = typeof navigator === "undefined"
    ? ""
    : navigator.userAgent,
): InputPlatform {
  return /Mac|iPhone|iPad/i.test(userAgent) ? "mac" : "desktop";
}