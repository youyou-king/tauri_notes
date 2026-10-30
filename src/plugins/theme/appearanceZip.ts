import {
  validateAppearancePack,
  type AppearancePackManifest,
} from "./appearancePack";
import { sha256Base64 } from "./integrity";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_ENTRIES = 256;
const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const MAX_ASSET_BYTES = 4 * 1024 * 1024;

export type AppearanceZipEntry = {
  path: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  dataOffset: number;
};

export type AppearancePackReadResult = {
  pack?: AppearancePackManifest;
  assets?: string[];
  warnings?: string[];
  error?: string;
};

function fail(error: string): never {
  throw new Error(error);
}

function normalizedPath(name: string): string {
  const path = name.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !path ||
    path.includes("\0") ||
    path.split("/").some((part) => part === ".." || part === ".")
  ) {
    fail(`非法资源路径：${name}`);
  }
  return path;
}

export function readZipEntries(buffer: ArrayBuffer): AppearanceZipEntry[] {
  const view = new DataView(buffer);
  const minimum = Math.max(0, buffer.byteLength - 65557);
  let eocd = -1;
  for (let offset = buffer.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) {
    fail("不是有效的 ZIP 文件");
  }
  const disk = view.getUint16(eocd + 4, true);
  const centralDisk = view.getUint16(eocd + 6, true);
  const count = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (disk !== 0 || centralDisk !== 0) {
    fail("不支持分卷 ZIP");
  }
  if (
    count === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  ) {
    fail("不支持 ZIP64");
  }
  if (count === 0 || count > MAX_ENTRIES) {
    fail("ZIP 条目数量不合法");
  }
  const entries: AppearanceZipEntry[] = [];
  const names = new Set<string>();
  let offset = centralOffset;
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    if (
      offset + 46 > buffer.byteLength ||
      view.getUint32(offset, true) !== CENTRAL_SIGNATURE
    ) {
      fail("ZIP 中央目录损坏");
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    if ((flags & 1) !== 0) {
      fail("不支持加密 ZIP");
    }
    if (method !== 0 && method !== 8) {
      fail("只支持存储或 deflate 压缩");
    }
    if (uncompressed > MAX_ASSET_BYTES) {
      fail("单个资源超过大小限制");
    }
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.byteLength) {
      fail("ZIP 文件名越界");
    }
    const path = normalizedPath(
      new TextDecoder().decode(new Uint8Array(buffer, nameStart, nameLength)),
    );
    if (names.has(path)) {
      fail(`ZIP 包含重复路径：${path}`);
    }
    names.add(path);
    total += uncompressed;
    if (total > MAX_TOTAL_BYTES) {
      fail("外观包解压后超过大小限制");
    }
    if (
      localOffset + 30 > buffer.byteLength ||
      view.getUint32(localOffset, true) !== LOCAL_SIGNATURE
    ) {
      fail("ZIP 本地文件头损坏");
    }
    const localName = view.getUint16(localOffset + 26, true);
    const localExtra = view.getUint16(localOffset + 28, true);
    entries.push({
      path,
      compressionMethod: method,
      compressedSize: compressed,
      uncompressedSize: uncompressed,
      dataOffset: localOffset + 30 + localName + localExtra,
    });
    offset = nameEnd + extraLength + commentLength;
  }
  return entries;
}

async function extractEntry(
  buffer: ArrayBuffer,
  entry: AppearanceZipEntry,
): Promise<Uint8Array> {
  const end = entry.dataOffset + entry.compressedSize;
  if (end > buffer.byteLength) {
    fail("ZIP 数据越界");
  }
  const compressed = new Uint8Array(
    buffer,
    entry.dataOffset,
    entry.compressedSize,
  );
  if (entry.compressionMethod === 0) {
    return compressed;
  }
  const Decompression = (
    globalThis as typeof globalThis & {
      DecompressionStream?: new (
        format: "deflate-raw",
      ) => DecompressionStream;
    }
  ).DecompressionStream;
  if (!Decompression) {
    fail("当前环境不支持 deflate 解压");
  }
  const stream = new Decompression("deflate-raw");
  const writer = stream.writable.getWriter();
  void writer.write(compressed);
  void writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export async function readAppearanceAsset(
  buffer: ArrayBuffer,
  path: string,
): Promise<Uint8Array | null> {
  try {
    const entry = readZipEntries(buffer).find(
      (candidate) => candidate.path === path,
    );
    if (!entry) {
      return null;
    }
    return await extractEntry(buffer, entry);
  } catch {
    return null;
  }
}

export async function readAppearancePack(
  buffer: ArrayBuffer,
): Promise<AppearancePackReadResult> {
  try {
    const entries = readZipEntries(buffer);
    const manifestEntry = entries.find(
      (entry) => entry.path === "appearance.json",
    );
    if (!manifestEntry) {
      fail("缺少 appearance.json");
    }
    if (manifestEntry.uncompressedSize > MAX_MANIFEST_BYTES) {
      fail("appearance.json 过大");
    }
    const manifestBytes = await extractEntry(buffer, manifestEntry);
    const text = new TextDecoder().decode(manifestBytes);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      fail("appearance.json 不是有效 JSON");
    }
    const result = validateAppearancePack(parsed);
    if (!result.pack) {
      fail(result.error ?? "外观包不合法");
    }
    for (const [path, expected] of Object.entries(
      result.pack.integrity ?? {},
    )) {
      const entry = entries.find(
        (candidate) => candidate.path === path,
      );
      if (!entry) {
        fail(`完整性清单缺少资源：${path}`);
      }
      const actual = await sha256Base64(
        await extractEntry(buffer, entry),
      );
      if (actual !== expected) {
        fail(`资源完整性校验失败：${path}`);
      }
    }
    return {
      pack: result.pack,
      assets: entries
        .map((entry) => entry.path)
        .filter((path) => path !== "appearance.json"),
      warnings: result.warnings,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
