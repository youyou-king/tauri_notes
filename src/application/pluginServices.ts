import { assetService } from "./assetService";
import { documentService } from "./documentService";
import { mapService } from "./mapService";
import { referenceClient } from "../infrastructure/tauriReferenceClient";
import type { LibraryId } from "../types";
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
      list: (libraryId: LibraryId) =>
        guarded("document.read", () => documentService.list(libraryId)),
      loadBlocks: (libraryId: LibraryId, documentId: string) =>
        guarded("document.read", () =>
          documentService.loadBlocks(libraryId, documentId),
        ),
      loadBlocksPreview: (libraryId: LibraryId, blockIds: string[]) =>
        guarded("document.read", () =>
          documentService.loadBlocksPreview(libraryId, blockIds),
        ),
      getTitle: (libraryId: LibraryId, documentId: string) =>
        guarded("document.read", () =>
          documentService.getTitle(libraryId, documentId),
        ),
      create: (libraryId: LibraryId, mapId: string, title: string) =>
        guarded("document.write", () =>
          documentService.create(libraryId, mapId, title),
        ),
      rename: (libraryId: LibraryId, documentId: string, title: string) =>
        guarded("document.write", () =>
          documentService.rename(libraryId, documentId, title),
        ),
      delete: (libraryId: LibraryId, documentId: string) =>
        guarded("document.write", () =>
          documentService.delete(libraryId, documentId),
        ),
    },
    maps: {
      loadMap: (libraryId: LibraryId, mapId: string) =>
        guarded("board.read", () => mapService.loadMap(libraryId, mapId)),
      loadOutline: (libraryId: LibraryId) =>
        guarded("board.read", () => mapService.loadOutline(libraryId)),
      createDocumentForNode: (libraryId: LibraryId, nodeId: string) =>
        guarded("board.write", () =>
          mapService.createDocumentForNode(libraryId, nodeId),
        ),
      createDocumentForRoot: (libraryId: LibraryId, mapId: string) =>
        guarded("board.write", () =>
          mapService.createDocumentForRoot(libraryId, mapId),
        ),
    },
    assets: {
      saveImage: (input: Parameters<typeof assetService.saveImage>[0]) =>
        guarded("fs.write", () => assetService.saveImage(input)),
    },
    reference: {
      listTargets: (libraryId: LibraryId) =>
        guarded("reference.read", () =>
          referenceClient.listTargets(libraryId),
        ),
      preview: (libraryId: LibraryId, referenceId: string) =>
        guarded("reference.read", () =>
          referenceClient.preview(libraryId, referenceId),
        ),
      relink: (
        libraryId: LibraryId,
        referenceId: string,
        targetDocumentId: string,
        targetBlockId: string,
      ) =>
        guarded("reference.write", () =>
          referenceClient.relink(
            libraryId,
            referenceId,
            targetDocumentId,
            targetBlockId,
          ),
        ),
    },
  };
}

export type PluginServices = ReturnType<typeof createPluginServices>;
