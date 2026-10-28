import { command } from "../infrastructure/tauri/client";
import type {
  MindMapNode,
  MindMapView,
  OutlineView,
} from "../types";

export const mapService = {
  loadOutline(workspace: string): Promise<OutlineView> {
    return command("load_outline", { workspace });
  },

  loadMap(workspace: string, mapId: string): Promise<MindMapView> {
    return command("load_mind_map", { workspace, mapId });
  },

  createMap(workspace: string, title: string): Promise<string> {
    return command("create_mind_map", { workspace, title });
  },

  renameMap(workspace: string, mapId: string, title: string): Promise<void> {
    return command("rename_mind_map", { workspace, mapId, title });
  },

  deleteMap(workspace: string, mapId: string): Promise<void> {
    return command("delete_mind_map", { workspace, mapId });
  },

  createNode(input: {
    workspace: string;
    mapId: string;
    parentId: string | null;
    title: string;
  }): Promise<string> {
    return command("create_map_node", input);
  },

  renameNode(workspace: string, nodeId: string, title: string): Promise<void> {
    return command("rename_map_node", { workspace, nodeId, title });
  },

  deleteNode(workspace: string, nodeId: string): Promise<void> {
    return command("delete_map_node", { workspace, nodeId });
  },

  setNodePosition(
    workspace: string,
    nodeId: string,
    x: number,
    y: number,
  ): Promise<void> {
    return command("set_map_node_position", { workspace, nodeId, x, y });
  },

  createDocumentForNode(
    workspace: string,
    nodeId: string,
  ): Promise<MindMapNode> {
    return command("create_document_for_map_node", { workspace, nodeId });
  },

  createDocumentForRoot(
    workspace: string,
    mapId: string,
  ): Promise<string> {
    return command("create_document_for_map_root", { workspace, mapId });
  },

  bindDocument(
    workspace: string,
    nodeId: string,
    documentId: string,
  ): Promise<void> {
    return command("bind_document_to_map_node", {
      workspace,
      nodeId,
      documentId,
    });
  },
};
