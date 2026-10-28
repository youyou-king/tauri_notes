import type { BlockAnchor } from "./block";
import type { BlockId, DocId } from "./ids";

export type BlockReference = BlockAnchor & {
  lastDocId: DocId;
  lastTitle: string;
};

export type ResolvedBlock = {
  blockId: BlockId;
  docId: DocId;
  docTitle: string;
  blockTitle: string;
  markdown: string;
  fingerprint: string;
  blockType?: string;
  contentJson?: string;
};

export type ReferenceState =
  | { status: "resolved"; block: ResolvedBlock }
  | { status: "missing"; reason: "source-missing" | "block-missing" }
  | { status: "changed"; reason: "fingerprint-mismatch"; block: ResolvedBlock };

export function referenceHasSource(reference: BlockReference): boolean {
  return Boolean(reference.blockId && reference.lastDocId);
}
