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
  positionSaved: boolean;
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

/** 书库稳定身份；与文件位置无关。 */
export type LibraryId = `lib_${string}`;

/** 书库当前所在的文件系统位置；只用于文件 I/O。 */
declare const libraryPathBrand: unique symbol;
export type LibraryPath = string & {
  readonly [libraryPathBrand]: true;
};

export function asLibraryPath(value: string): LibraryPath {
  return value as LibraryPath;
}

export type WorkspaceView = {
  /** 稳定身份，由后端书库 metadata 提供。 */
  id: LibraryId;
  root: LibraryPath;
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
