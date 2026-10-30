import {
  resolvePackOverrides,
  resolveSurfaceOverrides,
} from "../../kernel/sdk";
import {
  clearWallpaperAsset,
  loadDecorationAssets,
  loadWallpaperAsset,
} from "./appearanceAssets";

export type DecorationAppearance = {
  src: string;
  anchor: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  width: string;
  opacity: number;
  hideBelow?: number;
};

const STORAGE_KEY = "tauri-notes.appearance-pack.v1";

type AppliedState = {
  packId: string;
  previous: Map<string, string | null>;
  overrides: Record<string, string>;
  decorations: DecorationAppearance[];
};

let applied: AppliedState | null = null;

export function applyAppearanceColors(
  packId: string,
  colors: Record<string, string>,
  options: {
    wallpaperUrl?: string;
    decorations?: DecorationAppearance[];
    surfaces?: Record<string, Record<string, unknown>>;
  } = {},
): Record<string, string> {
  rollbackAppearance();
  const overrides = {
    ...resolvePackOverrides(colors),
    ...resolveSurfaceOverrides(options.surfaces ?? {}),
  };
  const wallpaper =
    options.wallpaperUrl === undefined
      ? null
      : `url("${options.wallpaperUrl}")`;
  const previous = new Map<string, string | null>();
  const root = document.documentElement;
  for (const [token, value] of Object.entries(overrides)) {
    previous.set(token, root.style.getPropertyValue(token) || null);
    root.style.setProperty(token, value);
  }
  previous.set(
    "--app-wallpaper",
    root.style.getPropertyValue("--app-wallpaper") || null,
  );
  if (wallpaper) {
    root.style.setProperty("--app-wallpaper", wallpaper);
  } else {
    root.style.removeProperty("--app-wallpaper");
  }
  applied = {
    packId,
    previous,
    overrides,
    decorations: options.decorations ?? [],
  };
  root.setAttribute("data-appearance-pack", packId);
  window.dispatchEvent(new CustomEvent("appearance:applied"));
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        packId,
        colors,
        surfaces: options.surfaces ?? {},
        decorations: (options.decorations ?? []).map(
          ({ src, anchor, width, opacity, hideBelow }) => ({
            src,
            anchor,
            width,
            opacity,
            hideBelow,
          }),
        ),
      }),
    );
  } catch {
    // Persistence must never break applying.
  }
  return overrides;
}

export function rollbackAppearance(): void {
  const state = applied;
  if (!state) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
    return;
  }
  const root = document.documentElement;
  for (const token of state.previous.keys()) {
    const previous = state.previous.get(token);
    if (previous) {
      root.style.setProperty(token, previous);
    } else {
      root.style.removeProperty(token);
    }
  }
  root.removeAttribute("data-appearance-pack");
  applied = null;
  void clearWallpaperAsset();
  window.dispatchEvent(new CustomEvent("appearance:applied"));
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export function appliedAppearancePackId(): string | null {
  return applied?.packId ?? null;
}

export function getAppliedDecorations(): DecorationAppearance[] {
  return applied?.decorations ?? [];
}

export async function restoreAppliedAppearance(): Promise<boolean> {
  let stored: {
    packId?: string;
    colors?: Record<string, string>;
    surfaces?: Record<string, Record<string, unknown>>;
    decorations?: DecorationAppearance[];
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return false;
    }
    stored = JSON.parse(raw) as typeof stored;
  } catch {
    return false;
  }
  if (
    !stored.packId ||
    !stored.colors ||
    typeof stored.colors !== "object"
  ) {
    return false;
  }
  const bytes = await loadWallpaperAsset();
  let wallpaperUrl: string | undefined;
  if (bytes) {
    wallpaperUrl = URL.createObjectURL(
      new Blob([bytes as BlobPart], { type: "image/webp" }),
    );
  }
  const decorationAssets = await loadDecorationAssets();
  const decorations = (stored.decorations ?? [])
    .map((decoration, index) => {
      const asset = decorationAssets[index];
      return asset
        ? {
            ...decoration,
            src: URL.createObjectURL(
              new Blob([asset as BlobPart], { type: "image/webp" }),
            ),
          }
        : decoration;
    });
  applyAppearanceColors(stored.packId, stored.colors, {
    wallpaperUrl,
    decorations,
    surfaces: stored.surfaces ?? {},
  });
  return true;
}
