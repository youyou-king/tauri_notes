function parseChannel(value: string): number | null {
  if (value.endsWith("%")) {
    const parsed = Number(value.slice(0, -1));
    return Number.isFinite(parsed) ? (parsed / 100) * 255 : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseColor(value: string): [number, number, number] | null {
  const text = value.trim();
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits =
      hex[1].length === 3
        ? hex[1]
            .split("")
            .map((digit) => digit + digit)
            .join("")
        : hex[1];
    return [
      Number.parseInt(digits.slice(0, 2), 16),
      Number.parseInt(digits.slice(2, 4), 16),
      Number.parseInt(digits.slice(4, 6), 16),
    ];
  }
  const rgb = text.match(
    /^rgba?\(\s*([^,\s]+)[,\s]+([^,\s]+)[,\s]+([^,\s)]+)/i,
  );
  if (rgb) {
    const channels = rgb.slice(1, 4).map(parseChannel);
    if (channels.every((channel) => channel !== null)) {
      return channels.map((channel) =>
        Math.max(0, Math.min(255, channel as number)),
      ) as [number, number, number];
    }
  }
  return null;
}

function luminance([red, green, blue]: [number, number, number]): number {
  const linear = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(
  foreground: string,
  background: string,
): number | null {
  const foregroundRgb = parseColor(foreground);
  const backgroundRgb = parseColor(background);
  if (!foregroundRgb || !backgroundRgb) {
    return null;
  }
  const first = luminance(foregroundRgb);
  const second = luminance(backgroundRgb);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

const CHECKS: Array<{
  foreground: string;
  background: string;
  minimum: number;
  label: string;
}> = [
  { foreground: "text", background: "canvas", minimum: 4.5, label: "正文/画布" },
  { foreground: "text", background: "panel", minimum: 4.5, label: "正文/面板" },
  { foreground: "textMuted", background: "canvas", minimum: 3, label: "次要文字/画布" },
  { foreground: "accent", background: "canvas", minimum: 3, label: "强调色/画布" },
];

export function contrastWarnings(
  colors: Record<string, string> | undefined,
): string[] {
  if (!colors) {
    return [];
  }
  const warnings: string[] = [];
  for (const check of CHECKS) {
    const foreground = colors[check.foreground];
    const background = colors[check.background];
    if (!foreground || !background) {
      continue;
    }
    const ratio = contrastRatio(foreground, background);
    if (ratio !== null && ratio < check.minimum) {
      warnings.push(
        `${check.label} 对比度 ${ratio.toFixed(1)}:1，低于 ${check.minimum}:1`,
      );
    }
  }
  return warnings;
}
