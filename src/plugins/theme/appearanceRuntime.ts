import type {
  AppearanceMode,
  AppearancePackManifest,
} from "./appearancePack";
import { readAppearanceAsset } from "./appearanceZip";
import {
  applyAppearanceColors,
  rollbackAppearance,
  type DecorationAppearance,
} from "./appearanceApplier";
import {
  clearAppearanceRuntime,
  loadAppearanceRuntime,
  saveAppearanceRuntime,
  type StoredAppearanceRuntime,
  type StoredDecorationAsset,
  type StoredVariantAssets,
} from "./appearanceAssets";

let runtime: StoredAppearanceRuntime | null = null;
let activeMode: AppearanceMode | null = null;
let activeUrls: string[] = [];

function variantAssets(mode: AppearanceMode): StoredVariantAssets {
  return (
    runtime?.assets[mode] ?? {
      decorations: [],
    }
  );
}

function imagePath(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const image = (value as { image?: unknown }).image;
  return typeof image === "string" ? image : undefined;
}

function assetUrl(bytes: Uint8Array | undefined): string | undefined {
  return bytes
    ? URL.createObjectURL(
        new Blob([bytes as BlobPart], { type: "image/webp" }),
      )
    : undefined;
}

function decorationAsset(
  raw: Record<string, unknown>,
  bytes: Uint8Array,
): StoredDecorationAsset {
  return {
    bytes,
    anchor:
      raw.anchor === "bottom-right" ||
      raw.anchor === "top-left" ||
      raw.anchor === "top-right"
        ? raw.anchor
        : "bottom-left",
    width: typeof raw.width === "string" ? raw.width : "22vw",
    opacity: typeof raw.opacity === "number" ? raw.opacity : 1,
    hideBelow:
      typeof raw.hideBelow === "number" ? raw.hideBelow : undefined,
  };
}

async function readVariantAssets(
  pack: AppearancePackManifest,
  buffer: ArrayBuffer,
  mode: AppearanceMode,
): Promise<StoredVariantAssets> {
  const variant = pack.variants[mode];
  const background = variant?.skin?.background;
  const path = imagePath(background);
  const wallpaper = path
    ? (await readAppearanceAsset(buffer, path)) ?? undefined
    : undefined;
  const rawDecorations = Array.isArray(variant?.skin?.decorations)
    ? variant.skin.decorations.slice(0, 6)
    : [];
  const decorations: StoredDecorationAsset[] = [];
  for (const raw of rawDecorations) {
    const src = typeof raw.src === "string" ? raw.src : undefined;
    if (!src) {
      continue;
    }
    const bytes = await readAppearanceAsset(buffer, src);
    if (bytes) {
      decorations.push(decorationAsset(raw, bytes));
    }
  }
  return { wallpaper, decorations };
}

async function activate(mode: AppearanceMode): Promise<AppearanceMode | null> {
  if (!runtime) {
    return null;
  }
  const pack = runtime.pack;
  const target = pack.modes.includes(mode) ? mode : pack.modes[0];
  const assets = variantAssets(target);
  const surfaces =
    (pack.variants[target]?.skin?.surfaces as
      | Record<string, Record<string, unknown>>
      | undefined) ?? {};
  const colors = pack.variants[target]?.theme?.colors ?? {};
  const wallpaperUrl = assetUrl(assets.wallpaper);
  const nextUrls: string[] = [];
  if (wallpaperUrl) {
    nextUrls.push(wallpaperUrl);
  }
  const decorations: DecorationAppearance[] = assets.decorations.map(
    (decoration) => {
      const url = assetUrl(decoration.bytes) ?? "";
      if (url) {
        nextUrls.push(url);
      }
      return {
        src: url,
        anchor: decoration.anchor,
        width: decoration.width,
        opacity: decoration.opacity,
        hideBelow: decoration.hideBelow,
      };
    },
  );

  applyAppearanceColors(pack.id, colors, {
    wallpaperUrl,
    decorations,
    surfaces,
  });
  for (const url of activeUrls) {
    URL.revokeObjectURL(url);
  }
  activeUrls = nextUrls;
  activeMode = target;
  document.documentElement.dataset.appearanceMode = target;
  window.dispatchEvent(
    new CustomEvent("appearance:runtime", {
      detail: { packId: pack.id, mode: target },
    }),
  );
  return target;
}

export async function applyAppearancePack(
  pack: AppearancePackManifest,
  buffer: ArrayBuffer,
  mode: AppearanceMode,
): Promise<AppearanceMode> {
  const assets: StoredAppearanceRuntime["assets"] = {};
  for (const variantMode of pack.modes) {
    assets[variantMode] = await readVariantAssets(
      pack,
      buffer,
      variantMode,
    );
  }
  runtime = { pack, assets };
  try {
    await saveAppearanceRuntime(runtime);
  } catch {
    // Applying must still work when IndexedDB is unavailable.
  }
  return (await activate(mode)) ?? mode;
}

export async function restoreAppearanceRuntime(
  mode: AppearanceMode,
): Promise<boolean> {
  const stored = await loadAppearanceRuntime();
  if (!stored) {
    return false;
  }
  runtime = stored;
  await activate(mode);
  return true;
}

export async function syncAppearanceMode(
  mode: AppearanceMode,
): Promise<boolean> {
  if (!runtime) {
    return false;
  }
  const target = runtime.pack.modes.includes(mode)
    ? mode
    : runtime.pack.modes[0];
  if (activeMode === target) {
    return true;
  }
  await activate(mode);
  return true;
}

export async function rollbackAppearanceRuntime(): Promise<void> {
  runtime = null;
  activeMode = null;
  for (const url of activeUrls) {
    URL.revokeObjectURL(url);
  }
  activeUrls = [];
  delete document.documentElement.dataset.appearanceMode;
  await clearAppearanceRuntime();
  rollbackAppearance();
}

export function activeAppearanceMode(): AppearanceMode | null {
  return activeMode;
}
