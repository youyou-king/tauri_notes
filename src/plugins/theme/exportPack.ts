import type { ThemeManifest } from "../../ui/sdk";
import type { AppearancePackManifest } from "./appearancePack";

const TOKEN_TO_COLOR: Record<string, string> = {
  "--bg": "canvas",
  "--bg-panel": "panel",
  "--bg-elevated": "elevated",
  "--border": "border",
  "--text": "text",
  "--muted": "textMuted",
  "--accent": "accent",
};

export function themeToAppearancePack(
  theme: ThemeManifest,
): AppearancePackManifest {
  const colors: Record<string, string> = {};
  for (const [token, color] of Object.entries(TOKEN_TO_COLOR)) {
    const value = theme.tokens[token];
    if (value) {
      colors[color] = value;
    }
  }
  return {
    schema: 1,
    id: theme.id,
    name: theme.name,
    version: "1.0.0",
    modes: [theme.base],
    variants: {
      [theme.base]: { theme: { colors } },
    },
  };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export type ZipFile = { path: string; data: Uint8Array };

export function createStoredZip(files: ZipFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.path);
    const checksum = crc32(file.data);
    const local = new Uint8Array(30 + name.length + file.data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, file.data.length, true);
    localView.setUint32(22, file.data.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(file.data, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, file.data.length, true);
    centralView.setUint32(24, file.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length;
  }

  const centralOffset = offset;
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(
    centralOffset + centralSize + 22,
  );
  let cursor = 0;
  for (const part of [...locals, ...centrals]) {
    output.set(part, cursor);
    cursor += part.length;
  }
  const eocd = new DataView(output.buffer, cursor);
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, files.length, true);
  eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, centralOffset, true);
  return output;
}

export function themeAppearancePackBytes(
  theme: ThemeManifest,
): Uint8Array {
  const manifest = themeToAppearancePack(theme);
  return createStoredZip([
    {
      path: "appearance.json",
      data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
    },
  ]);
}
