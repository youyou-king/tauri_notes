import { invoke } from "@tauri-apps/api/core";
import type { ReferenceResolver } from "../application/ports";
import {
  asBlockId,
  type BlockId,
  type DocId,
} from "../domain/ids";
import type {
  BlockReference,
  ReferenceState,
  ResolvedBlock,
} from "../domain/reference";

export type IndexedBlock = {
  blockId: string;
  docId: string;
  docTitle: string;
  blockTitle: string;
  markdown: string;
  fingerprint: string;
  startLine: number;
  endLine: number;
  blockType: string;
  contentJson: string;
};

export class TauriReferenceResolver implements ReferenceResolver {
  private indexPromise: Promise<Map<BlockId, IndexedBlock>> | null = null;

  constructor(private readonly workspaceRoot: string) {}

  reload(): void {
    this.indexPromise = null;
  }

  async list(): Promise<ResolvedBlock[]> {
    const index = await this.load();
    return [...index.values()].map((source) => this.toResolved(source));
  }

  async resolve(reference: BlockReference): Promise<ReferenceState> {
    let index = await this.load();
    let source = index.get(reference.blockId);
    if (!source) {
      // 新建引用后源文件可能刚写入；失效一次后刷新索引再试。
      this.reload();
      index = await this.load();
      source = index.get(reference.blockId);
    }
    if (!source) {
      // 保存/索引存在短暂竞态，再等一拍重试一次。
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      this.reload();
      index = await this.load();
      source = index.get(reference.blockId);
    }
    if (!source) {
      return { status: "missing", reason: "block-missing" };
    }

    const block = this.toResolved(source);

    if (source.fingerprint !== reference.fingerprint) {
      return {
        status: "changed",
        reason: "fingerprint-mismatch",
        block,
      };
    }
    return { status: "resolved", block };
  }

  private toResolved(source: IndexedBlock): ResolvedBlock {
    return {
      blockId: asBlockId(source.blockId),
      docId: source.docId as DocId,
      docTitle: source.docTitle,
      blockTitle: source.blockTitle,
      markdown: source.markdown,
      fingerprint: source.fingerprint,
      blockType: source.blockType,
      contentJson: source.contentJson,
    };
  }

  private load(): Promise<Map<BlockId, IndexedBlock>> {
    this.indexPromise ??= invoke<IndexedBlock[]>("index_blocks_db", {
      workspace: this.workspaceRoot,
    }).then(
      (blocks) =>
        new Map(
          blocks.map((block) => [asBlockId(block.blockId), block] as const),
        ),
    );
    return this.indexPromise;
  }
}
