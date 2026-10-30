import { contrastWarnings } from "../../kernel/sdk";
import { isSha256Integrity } from "./integrity";

export type AppearanceMode = "dark" | "light";

export type AppearanceThemeVariant = {
  colors?: Record<string, string>;
  typography?: Record<string, string | number>;
  shape?: Record<string, string | number>;
};

export type AppearanceSkinVariant = {
  background?: Record<string, unknown>;
  decorations?: Array<Record<string, unknown>>;
  surfaces?: Record<string, Record<string, unknown>>;
  components?: Record<string, unknown>;
  map?: Record<string, unknown>;
};

export type AppearanceSignature = {
  algorithm: "ecdsa-p256-sha256";
  publicKey: string;
  signature: string;
  publisher?: string;
};

export type AppearancePackManifest = {
  schema: 1;
  id: string;
  name: string;
  version: string;
  author?: string;
  modes: AppearanceMode[];
  integrity?: Record<string, string>;
  signature?: AppearanceSignature;
  variants: Partial<
    Record<
      AppearanceMode,
      {
        theme?: AppearanceThemeVariant;
        skin?: AppearanceSkinVariant;
      }
    >
  >;
};

const ID = /^[a-z0-9][a-z0-9-]{0,40}$/;
const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const UNSAFE =
  /url\s*\(|@import|javascript:|expression\s*\(|\.\.[/\\]/i;

export function validateAppearancePack(
  raw: unknown,
): {
  pack?: AppearancePackManifest;
  error?: string;
  warnings?: string[];
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "appearance.json 必须是对象" };
  }
  const source = raw as Record<string, unknown>;
  if (source.schema !== 1) {
    return { error: "不支持的 schema，当前只支持 1" };
  }
  if (typeof source.id !== "string" || !ID.test(source.id)) {
    return { error: "id 只能包含小写字母、数字和连字符" };
  }
  if (
    typeof source.name !== "string" ||
    !source.name.trim() ||
    source.name.length > 60
  ) {
    return { error: "name 必须为 1-60 个字符" };
  }
  if (typeof source.version !== "string" || !VERSION.test(source.version)) {
    return { error: "version 必须是语义化版本" };
  }
  if (
    !Array.isArray(source.modes) ||
    source.modes.length === 0 ||
    source.modes.some((mode) => mode !== "dark" && mode !== "light")
  ) {
    return { error: "modes 必须包含 dark 或 light" };
  }
  if (
    !source.variants ||
    typeof source.variants !== "object" ||
    Array.isArray(source.variants)
  ) {
    return { error: "variants 必须是对象" };
  }
  for (const mode of source.modes as AppearanceMode[]) {
    if (!(mode in (source.variants as Record<string, unknown>))) {
      return { error: `缺少 ${mode} variant` };
    }
  }
  const json = JSON.stringify(source);
  if (UNSAFE.test(json)) {
    return { error: "外观包包含不安全路径或表达式" };
  }
  if (source.signature !== undefined) {
    if (
      !source.signature ||
      typeof source.signature !== "object" ||
      Array.isArray(source.signature)
    ) {
      return { error: "signature 必须是对象" };
    }
    const signature = source.signature as Record<string, unknown>;
    if (signature.algorithm !== "ecdsa-p256-sha256") {
      return { error: "不支持的发布者签名算法" };
    }
    const key = signature.publicKey;
    const value = signature.signature;
    const base64url = /^[A-Za-z0-9_-]+$/;
    if (
      typeof key !== "string" ||
      key.length < 40 ||
      !base64url.test(key) ||
      typeof value !== "string" ||
      value.length < 40 ||
      !base64url.test(value)
    ) {
      return { error: "发布者签名格式不正确" };
    }
    if (
      signature.publisher !== undefined &&
      (typeof signature.publisher !== "string" ||
        !signature.publisher.trim() ||
        signature.publisher.length > 60)
    ) {
      return { error: "发布者名称必须为 1-60 个字符" };
    }
  }
  if (source.integrity !== undefined) {
    if (
      !source.integrity ||
      typeof source.integrity !== "object" ||
      Array.isArray(source.integrity)
    ) {
      return { error: "integrity 必须是资源路径到 SHA-256 的对象" };
    }
    const entries = Object.entries(
      source.integrity as Record<string, unknown>,
    );
    if (entries.length > 64) {
      return { error: "integrity 条目过多" };
    }
    for (const [path, value] of entries) {
      if (
        !path ||
        path === "appearance.json" ||
        path.startsWith("/") ||
        path.includes("..") ||
        path.includes("\\")
      ) {
        return { error: `integrity 包含不安全资源路径：${path}` };
      }
      if (!isSha256Integrity(value)) {
        return { error: `integrity 格式不正确：${path}` };
      }
    }
  }
  const warnings: string[] = [];
  const variants = source.variants as Record<
    string,
    { theme?: { colors?: Record<string, string> } }
  >;
  for (const mode of source.modes as AppearanceMode[]) {
    for (const warning of contrastWarnings(
      variants[mode]?.theme?.colors,
    )) {
      warnings.push(`${mode}: ${warning}`);
    }
  }
  return {
    pack: source as AppearancePackManifest,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
