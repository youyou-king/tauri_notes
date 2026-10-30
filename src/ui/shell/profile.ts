export type ShellKind = "desktop" | "tablet" | "mobile";

export type ShellProfile = {
  kind: ShellKind;
  layout: "dock" | "stack";
  touchPreferred: boolean;
  minWidth: number;
};

const MOBILE_MAX = 720;
const TABLET_MAX = 1100;

export function resolveShellProfile(width: number): ShellProfile {
  if (width < MOBILE_MAX) {
    return {
      kind: "mobile",
      layout: "stack",
      touchPreferred: true,
      minWidth: width,
    };
  }
  if (width < TABLET_MAX) {
    return {
      kind: "tablet",
      layout: "dock",
      touchPreferred: true,
      minWidth: width,
    };
  }
  return {
    kind: "desktop",
    layout: "dock",
    touchPreferred: false,
    minWidth: width,
  };
}
