export const THEME_COLOR_TOKENS: Record<string, string> = {
  canvas: "--bg",
  panel: "--bg-panel",
  panelRaised: "--bg-elevated",
  panelHover: "--bg-hover",
  border: "--border",
  text: "--text",
  textMuted: "--muted",
  heading: "--heading",
  accent: "--accent",
  accentText: "--brand-mark-text",
  danger: "--danger",
  focus: "--focus",
};

export function resolvePackOverrides(
  colors: Record<string, string>,
): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const [key, value] of Object.entries(colors)) {
    const token = THEME_COLOR_TOKENS[key];
    if (token) {
      overrides[token] = value;
    }
  }
  return overrides;
}

export const SURFACE_TOKEN_GROUPS: Record<string, string> = {
  panel: "--surface-panel",
  dialog: "--surface-dialog",
  editor: "--surface-editor",
  toolbar: "--surface-toolbar",
};

const SURFACE_FIELDS: Record<string, string> = {
  background: "-bg",
  blur: "-blur",
  border: "-border",
  radius: "-radius",
  shadow: "-shadow",
};

export function resolveSurfaceOverrides(
  surfaces: Record<string, Record<string, unknown>>,
): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const [group, values] of Object.entries(surfaces)) {
    const prefix = SURFACE_TOKEN_GROUPS[group];
    if (!prefix) {
      continue;
    }
    for (const [field, value] of Object.entries(values)) {
      const suffix = SURFACE_FIELDS[field];
      if (!suffix) {
        continue;
      }
      const resolved =
        field === "blur" && typeof value === "number"
          ? `${value}px`
          : typeof value === "string" || typeof value === "number"
            ? String(value)
            : undefined;
      if (resolved !== undefined) {
        overrides[`${prefix}${suffix}`] = resolved;
      }
    }
  }
  return overrides;
}
