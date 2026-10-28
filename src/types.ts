export type NodeView = {
  id: string;
  title: string;
  hasDocument: boolean;
  children: NodeView[];
};

export type MapView = {
  id: string;
  title: string;
  root: NodeView;
};

export type MindMapNode = {
  id: string;
  title: string;
  hasDocument: boolean;
  documentId: string | null;
  headingBlockId: string | null;
  positionX: number;
  positionY: number;
  children: MindMapNode[];
};

export type MindMapView = {
  id: string;
  title: string;
  root: MindMapNode;
};

export type OutlineView = {
  title: string;
  maps: MindMapView[];
  unfiled: Array<{ documentId: string; title: string }>;
};

export type WorkspaceView = {
  root: string;
  title: string;
  maps: MapView[];
};

export type Block = {
  id: string;
  kind:
    | "heading"
    | "paragraph"
    | "list"
    | "quote"
    | "code"
    | "table"
    | "rule";
  text: string;
};

export type BlockDocument = {
  nodeId: string;
  path: string;
  content: string;
  blocks: Block[];
};

export type DocumentView = {
  nodeId: string;
  path: string;
  content: string;
  modified: number;
};

export type SearchHit = {
  mapId: string;
  mapTitle: string;
  nodeId: string;
  nodeTitle: string;
  excerpt: string;
};
