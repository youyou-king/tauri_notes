import type { AppearancePackManifest } from "../appearancePack";

const FALLBACKS = {
  canvas: "#0f1218",
  panel: "#171a21",
  text: "#e6e9ef",
  textMuted: "#9aa4b2",
  accent: "#5e9cff",
};

export function AppearancePreview({
  pack,
  mode,
  wallpaperUrl,
  decorations = [],
}: {
  pack: AppearancePackManifest;
  mode: "dark" | "light";
  wallpaperUrl?: string;
  decorations?: Array<{ url: string; anchor: string }>;
}) {
  const variant =
    pack.variants[mode] ??
    pack.variants[pack.modes[0]] ??
    pack.variants.dark ??
    pack.variants.light;
  const colors = variant?.theme?.colors ?? {};
  const background = variant?.skin?.background as
    | { image?: unknown }
    | undefined;
  const decorationCount = Array.isArray(variant?.skin?.decorations)
    ? variant.skin.decorations.length
    : 0;
  const surfaces = Object.keys(variant?.skin?.surfaces ?? {});

  return (
    <section
      className="appearance-preview"
      style={{
        background: colors.canvas ?? FALLBACKS.canvas,
        backgroundImage: wallpaperUrl
          ? `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url("${wallpaperUrl}")`
          : undefined,
        backgroundSize: wallpaperUrl ? "cover" : undefined,
        backgroundPosition: wallpaperUrl ? "center" : undefined,
        color: colors.text ?? FALLBACKS.text,
      }}
      data-wallpaper={wallpaperUrl ? "true" : "false"}
      aria-label="外观包预览"
    >
      <div
        className="appearance-preview-panel"
        style={{
          background: colors.panel ?? FALLBACKS.panel,
          borderColor: colors.border ?? "rgba(148, 163, 184, 0.25)",
        }}
      >
        <strong style={{ color: colors.text ?? FALLBACKS.text }}>
          预览
        </strong>
        <span style={{ color: colors.textMuted ?? FALLBACKS.textMuted }}>
          仅预览，未应用
        </span>
        {decorations.length > 0 && (
          <div className="appearance-preview-decorations">
            {decorations.map((decoration, index) => (
              <img
                key={`${decoration.url}:${index}`}
                className="appearance-preview-decoration"
                src={decoration.url}
                alt=""
                title={decoration.anchor}
              />
            ))}
          </div>
        )}
        <div className="appearance-preview-swatches">
          {Object.entries(colors).map(([key, value]) => (
            <span
              key={key}
              className="appearance-preview-swatch"
              style={{ background: value }}
              title={`${key}: ${value}`}
            />
          ))}
          <span
            className="appearance-preview-swatch"
            style={{ background: colors.accent ?? FALLBACKS.accent }}
            title="accent"
          />
        </div>
        <p style={{ color: colors.textMuted ?? FALLBACKS.textMuted }}>
          {pack.name} · {mode} · {pack.version}
        </p>
        <small style={{ color: colors.textMuted ?? FALLBACKS.textMuted }}>
          {typeof background?.image === "string"
            ? `壁纸: ${background.image} · `
            : "无壁纸 · "}
          {decorationCount} 个装饰 ·{" "}
          {surfaces.length > 0
            ? `表面: ${surfaces.join(", ")}`
            : "无表面覆盖"}
        </small>
      </div>
    </section>
  );
}
