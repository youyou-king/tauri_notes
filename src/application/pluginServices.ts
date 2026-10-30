import { assetService } from "./assetService";
import { documentService } from "./documentService";
import { mapService } from "./mapService";
import { referenceClient } from "../infrastructure/tauriReferenceClient";
import type { PluginManifest } from "../kernel/plugin";

export function assertPluginCapability(
  manifest: PluginManifest,
  capability: string,
): void {
  if (!manifest.capabilities.includes(capability)) {
    throw new Error(
      `插件 ${manifest.id} 缺少能力 ${capability}，已阻止服务调用`,
    );
  }
}

export function createPluginServices(manifest: PluginManifest) {
  const guarded = <T>(
    capability: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    assertPluginCapability(manifest, capability);
    return operation();
  };

  return {
    document: {
      list: (workspace: string) =>
        guarded("document.read", () => documentService.list(workspace)),
      loadBlocks: (workspace: string, documentId: string) =>
        guarded("document.read", () =>
          documentService.loadBlocks(workspace, documentId),
        ),
      loadBlocksPreview: (workspace: string, blockIds: string[]) =>
        guarded("document.read", () =>
          documentService.loadBlocksPreview(workspace, blockIds),
        ),
      getTitle: (workspace: string, documentId: string) =>
        guarded("document.read", () =>
          documentService.getTitle(workspace, documentId),
        ),
      create: (workspace: string, mapId: string, title: string) =>
        guarded("document.write", () =>
          documentService.create(workspace, mapId, title),
        ),
      rename: (workspace: string, documentId: string, title: string) =>
        guarded("document.write", () =>
          documentService.rename(workspace, documentId, title),
        ),
      delete: (workspace: string, documentId: string) =>
        guarded("document.write", () =>
          documentService.delete(workspace, documentId),
        ),
    },
    maps: {
      loadMap: (workspace: string, mapId: string) =>
        guarded("board.read", () => mapService.loadMap(workspace, mapId)),
      loadOutline: (workspace: string) =>
        guarded("board.read", () => mapService.loadOutline(workspace)),
      createDocumentForNode: (workspace: string, nodeId: string) =>
        guarded("board.write", () =>
          mapService.createDocumentForNode(workspace, nodeId),
        ),
      createDocumentForRoot: (workspace: string, mapId: string) =>
        guarded("board.write", () =>
          mapService.createDocumentForRoot(workspace, mapId),
        ),
    },
    assets: {
      saveImage: (input: Parameters<typeof assetService.saveImage>[0]) =>
        guarded("fs.write", () => assetService.saveImage(input)),
    },
    reference: {
      listTargets: (workspace: string) =>
        guarded("reference.read", () =>
          referenceClient.listTargets(workspace),
        ),
      preview: (workspace: string, referenceId: string) =>
        guarded("reference.read", () =>
          referenceClient.preview(workspace, referenceId),
        ),
      relink: (
        workspace: string,
        referenceId: string,
        targetDocumentId: string,
        targetBlockId: string,
      ) =>
        guarded("reference.write", () =>
          referenceClient.relink(
            workspace,
            referenceId,
            targetDocumentId,
            targetBlockId,
          ),
        ),
    },
  };
}

export type PluginServices = ReturnType<typeof createPluginServices>;
