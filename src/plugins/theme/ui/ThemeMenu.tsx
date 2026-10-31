import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  useTheme,
  type ThemeManifest,
} from "../../../ui/sdk";
import {
  readAppearanceAsset,
  readAppearancePack,
} from "../appearanceZip";
import {
  appliedAppearancePackId,
  applyAppearanceColors,
  rollbackAppearance,
  type DecorationAppearance,
} from "../appearanceApplier";
import {
  saveDecorationAssets,
  saveWallpaperAsset,
} from "../appearanceAssets";
import type { AppearancePackManifest } from "../appearancePack";
import { AppearancePreview } from "./AppearancePreview";
import { themeAppearancePackBytes } from "../exportPack";
import {
  trustPublisher,
  type AppearancePublisher,
} from "../publisher";
import { ThemeEditor } from "./ThemeEditor";

const BUILT_INS: Array<[ "dark" | "light" | "system", string]> = [
  ["dark", "深色"],
  ["light", "浅色"],
  ["system", "跟随系统"],
];

export function ThemeMenu({
  onClose,
  inline = false,
  embedded = false,
  onOpenSettings,
}: {
  onClose: () => void;
  inline?: boolean;
  embedded?: boolean;
  onOpenSettings?: () => void;
}) {
  const {
    mode,
    resolved,
    customThemes,
    setMode,
    importTheme,
    removeTheme,
    exportTheme,
  } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const packRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [packStatus, setPackStatus] = useState<string | null>(() =>
    appliedAppearancePackId() ? "已应用外观包" : null,
  );
  const [packWarnings, setPackWarnings] = useState<string[]>([]);
  const [pendingPack, setPendingPack] =
    useState<AppearancePackManifest | null>(null);
  const [pendingBuffer, setPendingBuffer] = useState<ArrayBuffer | null>(
    null,
  );
  const [publisher, setPublisher] = useState<AppearancePublisher | null>(
    null,
  );
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  const [previewWallpaperUrl, setPreviewWallpaperUrl] = useState<
    string | null
  >(null);
  const [previewDecorations, setPreviewDecorations] = useState<
    Array<{ url: string; anchor: string }>
  >([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ThemeManifest | undefined>();

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    if (!pendingPack || !pendingBuffer) {
      setPreviewWallpaperUrl(null);
      setPreviewDecorations([]);
      return;
    }
    const pack = pendingPack;
    const buffer = pendingBuffer;
    const variantKey = pack.modes.includes(resolved)
      ? resolved
      : pack.modes[0];
    const variant = pack.variants[variantKey];
    const background = variant?.skin?.background as
      | { image?: unknown }
      | undefined;
    const imagePath =
      typeof background?.image === "string" ? background.image : undefined;
    const rawDecorations = Array.isArray(variant?.skin?.decorations)
      ? variant.skin.decorations.slice(0, 6)
      : [];

    void (async () => {
      let wallpaperUrl: string | null = null;
      if (imagePath) {
        const bytes = await readAppearanceAsset(buffer, imagePath);
        if (cancelled) {
          return;
        }
        if (bytes) {
          wallpaperUrl = URL.createObjectURL(
            new Blob([bytes as BlobPart], { type: "image/webp" }),
          );
          urls.push(wallpaperUrl);
        }
      }
      const decorations: Array<{ url: string; anchor: string }> = [];
      for (const raw of rawDecorations) {
        const src = typeof raw.src === "string" ? raw.src : undefined;
        if (!src) {
          continue;
        }
        const bytes = await readAppearanceAsset(buffer, src);
        if (cancelled) {
          return;
        }
        if (!bytes) {
          continue;
        }
        const url = URL.createObjectURL(
          new Blob([bytes as BlobPart], { type: "image/webp" }),
        );
        urls.push(url);
        decorations.push({
          url,
          anchor:
            typeof raw.anchor === "string" ? raw.anchor : "bottom-left",
        });
      }
      setPreviewWallpaperUrl(wallpaperUrl);
      setPreviewDecorations(decorations);
    })();
    return () => {
      cancelled = true;
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [pendingBuffer, pendingPack, resolved]);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const result = importTheme(await file.text());
    if (!result.ok) {
      setError(result.error ?? "导入失败");
      return;
    }
    setError(null);
    onClose();
  }

  async function onPackFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const buffer = await file.arrayBuffer();
    const result = await readAppearancePack(buffer);
    if (result.error || !result.pack) {
      setError(result.error ?? "导入外观包失败");
      setPackStatus(null);
      setPackWarnings([]);
      setPublisher(null);
      return;
    }
    setError(null);
    setPackWarnings(result.warnings ?? []);
    setPublisher(result.publisher ?? null);
    setPendingPack(result.pack);
    setPendingBuffer(buffer);
    setPackStatus(
      `已校验：${result.pack.name}（${result.assets?.length ?? 0} 个资源）`,
    );
  }

  async function applyPack() {
    const pack = pendingPack;
    if (!pack || (publisher && !publisher.trusted)) {
      return;
    }
    const variantKey = pack.modes.includes(resolved)
      ? resolved
      : pack.modes[0];
    const variant = pack.variants[variantKey];
    const colors = variant?.theme?.colors ?? {};
    const background = variant?.skin?.background as
      | { image?: unknown }
      | undefined;
    const imagePath =
      typeof background?.image === "string" ? background.image : undefined;
    let nextWallpaper: string | null = null;
    if (imagePath && pendingBuffer) {
      const bytes = await readAppearanceAsset(pendingBuffer, imagePath);
      if (bytes) {
        if (wallpaperUrl) {
          URL.revokeObjectURL(wallpaperUrl);
        }
        nextWallpaper = URL.createObjectURL(
          new Blob([bytes as BlobPart], { type: "image/webp" }),
        );
        setWallpaperUrl(nextWallpaper);
        void saveWallpaperAsset(bytes);
      }
    }
    const rawDecorations = variant?.skin?.decorations;
    const decorationAssets: Uint8Array[] = [];
    const decorations: DecorationAppearance[] = [];
    if (Array.isArray(rawDecorations) && pendingBuffer) {
      for (const raw of rawDecorations) {
        const src = typeof raw.src === "string" ? raw.src : undefined;
        if (!src) {
          continue;
        }
        const bytes = await readAppearanceAsset(pendingBuffer, src);
        if (!bytes) {
          continue;
        }
        const url = URL.createObjectURL(
          new Blob([bytes as BlobPart], { type: "image/webp" }),
        );
        decorationAssets.push(bytes);
        decorations.push({
          src: url,
          anchor:
            raw.anchor === "bottom-right" ||
            raw.anchor === "top-left" ||
            raw.anchor === "top-right"
              ? raw.anchor
              : "bottom-left",
          width:
            typeof raw.width === "string" ? raw.width : "22vw",
          opacity:
            typeof raw.opacity === "number" ? raw.opacity : 1,
          hideBelow:
            typeof raw.hideBelow === "number"
              ? raw.hideBelow
              : undefined,
        });
      }
      if (decorationAssets.length > 0) {
        void saveDecorationAssets(decorationAssets);
      }
    }
    applyAppearanceColors(pack.id, colors, {
      wallpaperUrl: nextWallpaper ?? undefined,
      decorations,
      surfaces:
        (variant?.skin?.surfaces as
          | Record<string, Record<string, unknown>>
          | undefined) ?? {},
    });
    setPackStatus(`已应用：${pack.name}（${variantKey}）`);
  }

  function rollbackPack() {
    if (wallpaperUrl) {
      URL.revokeObjectURL(wallpaperUrl);
      setWallpaperUrl(null);
    }
    rollbackAppearance();
    setPackStatus(
      pendingPack ? `已回退：${pendingPack.name}` : "已回退外观",
    );
  }

  function downloadTheme(id: string) {
    const json = exportTheme(id);
    if (!json) {
      return;
    }
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${id}.theme.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadPack(theme: ThemeManifest) {
    const bytes = themeAppearancePackBytes(theme);
    const url = URL.createObjectURL(
      new Blob([bytes as BlobPart], { type: "application/zip" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${theme.id}.tnlook`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className={
        inline
          ? "theme-settings-body"
          : embedded
            ? "theme-popover"
            : "toolbar-popover theme-popover"
      }
    >
      {BUILT_INS.map(([value, label]) => (
        <button
          key={value}
          type="button"
          className={mode === value ? "active" : ""}
          onClick={() => {
            setMode(value);
            onClose();
          }}
        >
          {label}
        </button>
      ))}

      {customThemes.length > 0 && (
        <div className="theme-group-label">自定义主题</div>
      )}
      {customThemes.map((theme) => (
        <div className="theme-row" key={theme.id}>
          <button
            type="button"
            className={mode === `custom:${theme.id}` ? "active" : ""}
            onClick={() => {
              setMode(`custom:${theme.id}`);
              onClose();
            }}
          >
            {theme.name}
          </button>
          <button
            type="button"
            className="theme-delete"
            title="编辑主题"
            onClick={() => {
              setEditing(theme);
              setEditorOpen(true);
            }}
          >
            ✎
          </button>
          <button
            type="button"
            className="theme-delete"
            title="导出主题"
            onClick={() => downloadTheme(theme.id)}
          >
            ↓
          </button>
          <button
            type="button"
            className="theme-delete"
            title="导出外观包"
            onClick={() => downloadPack(theme)}
          >
            ⤓
          </button>
          <button
            type="button"
            className="theme-delete"
            title="删除主题"
            onClick={() => removeTheme(theme.id)}
          >
            ×
          </button>
        </div>
      ))}

      {onOpenSettings && (
        <button type="button" onClick={onOpenSettings}>
          外观设置…
        </button>
      )}
      <div className="theme-divider" />
      <button
        type="button"
        onClick={() => {
          setEditing(undefined);
          setEditorOpen(true);
        }}
      >
        新建主题…
      </button>
      <button type="button" onClick={() => fileRef.current?.click()}>
        导入主题…
      </button>
      <button type="button" onClick={() => packRef.current?.click()}>
        导入外观包…
      </button>
      <input
        ref={fileRef}
        className="theme-file-input"
        type="file"
        accept=".json,application/json"
        onChange={(event) => void onFile(event)}
      />
      <input
        ref={packRef}
        className="theme-file-input"
        type="file"
        accept=".tnlook,.zip"
        onChange={(event) => void onPackFile(event)}
      />
      {error && <div className="theme-error">{error}</div>}
      {packStatus && (
        <div className="theme-pack-status">{packStatus}</div>
      )}
      {pendingPack && (
        <AppearancePreview
          pack={pendingPack}
          mode={resolved}
          wallpaperUrl={previewWallpaperUrl ?? undefined}
          decorations={previewDecorations}
        />
      )}
      {packWarnings.length > 0 && (
        <ul className="theme-pack-warnings">
          {packWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {publisher && (
        <div
          className={
            publisher.trusted
              ? "theme-publisher trusted"
              : "theme-publisher"
          }
          role="status"
        >
          <span>
            发布者：{publisher.name ?? "未命名"} ·{" "}
            {publisher.fingerprint}
          </span>
          {publisher.trusted ? (
            <span>已信任</span>
          ) : (
            <button
              type="button"
              onClick={() => {
                trustPublisher(publisher.fingerprint);
                setPublisher({ ...publisher, trusted: true });
              }}
            >
              信任发布者
            </button>
          )}
        </div>
      )}
      {(pendingPack || appliedAppearancePackId()) && (
        <div className="theme-pack-actions">
          {pendingPack && (
            <button
              type="button"
              className="primary"
              disabled={Boolean(publisher && !publisher.trusted)}
              onClick={applyPack}
            >
              应用外观
            </button>
          )}
          {appliedAppearancePackId() && (
            <button type="button" onClick={rollbackPack}>
              回退外观
            </button>
          )}
        </div>
      )}
      {editorOpen && (
        <ThemeEditor
          initial={editing}
          onClose={() => {
            setEditorOpen(false);
            setEditing(undefined);
            onClose();
          }}
        />
      )}
    </div>
  );
}
