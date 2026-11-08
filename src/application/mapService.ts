import { command } from "../infrastructure/tauri/client";
import type { LibraryId, MindMapNode, MindMapView, OutlineView } from "../types";

/** 导图服务：只接收 LibraryId；后端从 registry 解析路径。 */
export const mapService = {
  loadOutline(libraryId: LibraryId): Promise<OutlineView> {
    return command("load_outline", { libraryId });
  },

  loadMap(libraryId: LibraryId, mapId: string): Promise<MindMapView> {
    return command("load_mind_map", { libraryId, mapId });
  },

  createMap(libraryId: LibraryId, title: string): Promise<string> {
    return command("create_mind_map", { libraryId, title });
  },

  renameMap(
    libraryId: LibraryId,
    mapId: string,
    title: string,
  ): Promise<void> {
    return command("rename_mind_map", { libraryId, mapId, title });
  },

  deleteMap(libraryId: LibraryId, mapId: string): Promise<void> {
    return command("delete_mind_map", { libraryId, mapId });
  },

  createNode(input: {
    libraryId: LibraryId;
    mapId: string;
    parentId: string | null;
    title: string;
  }): Promise<string> {
    return command("create_map_node", input);
  },

  renameNode(
    libraryId: LibraryId,
    nodeId: string,
    title: string,
  ): Promise<void> {
    return command("rename_map_node", { libraryId, nodeId, title });
  },

  deleteNode(libraryId: LibraryId, nodeId: string): Promise<void> {
    return command("delete_map_node", { libraryId, nodeId });
  },

  setNodePositions(
    libraryId: LibraryId,
    positions: Array<{ nodeId: string; x: number; y: number }>,
  ): Promise<void> {
    return command("set_map_node_positions", { libraryId, positions });
  },

  createDocumentForNode(
    libraryId: LibraryId,
    nodeId: string,
  ): Promise<MindMapNode> {
    return command("create_document_for_map_node", { libraryId, nodeId });
  },

  createDocumentForRoot(
    libraryId: LibraryId,
    mapId: string,
  ): Promise<string> {
    return command("create_document_for_map_root", { libraryId, mapId });
  },

  bindDocument(
    libraryId: LibraryId,
    nodeId: string,
    documentId: string,
  ): Promise<void> {
    return command("bind_document_to_map_node", {
      libraryId,
      nodeId,
      documentId,
    });
  },
};