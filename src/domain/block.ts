import { asBlockId, type BlockId } from "./ids";

export type BlockKind =
  | "heading"
  | "paragraph"
  | "list"
  | "quote"
  | "code"
  | "table"
  | "rule";

export type BlockAnchor = {
  blockId: BlockId;
  fingerprint: string;
};

export type BlockSnapshot = BlockAnchor & {
  kind: BlockKind;
  text: string;
  startLine: number;
  endLine: number;
};

const BLOCK_COMMENT =
  /^\s*<!--\s*notes:block=([A-Za-z0-9_-]{4,64})\s*-->\s*$/;
const BLOCK_END_COMMENT =
  /^\s*<!--\s*notes:block-end=([A-Za-z0-9_-]{4,64})\s*-->\s*$/;

export const blockAnchorStrategy = {
  createComment(blockId: BlockId): string {
    return `<!-- notes:block=${blockId} -->`;
  },

  createEndComment(blockId: BlockId): string {
    return `<!-- notes:block-end=${blockId} -->`;
  },

  readComment(line: string): BlockId | null {
    const match = line.match(BLOCK_COMMENT);
    if (!match) {
      return null;
    }
    try {
      return asBlockId(match[1]);
    } catch {
      return null;
    }
  },

  readEndComment(line: string): BlockId | null {
    const match = line.match(BLOCK_END_COMMENT);
    if (!match) {
      return null;
    }
    try {
      return asBlockId(match[1]);
    } catch {
      return null;
    }
  },
};

/** 稳定、同步、无依赖的轻量指纹；只做失效兜底，不作为主身份。 */
export function blockFingerprint(text: string): string {
  let hash = 2166136261;
  const normalized = text.replace(/\s+/g, " ").trim();
  // 必须按 UTF-8 字节计算，才能与 Rust 端 fingerprint 对齐。
  const bytes = new TextEncoder().encode(normalized);
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function anchorFor(blockId: BlockId, text: string): BlockAnchor {
  return { blockId, fingerprint: blockFingerprint(text) };
}
