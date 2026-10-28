declare const docIdBrand: unique symbol;
declare const blockIdBrand: unique symbol;
declare const boardIdBrand: unique symbol;
declare const boardItemIdBrand: unique symbol;

export type DocId = string & { readonly [docIdBrand]: true };
export type BlockId = string & { readonly [blockIdBrand]: true };
export type BoardId = string & { readonly [boardIdBrand]: true };
export type BoardItemId = string & { readonly [boardItemIdBrand]: true };

export function makeDocId(mapId: string, nodeId: string): DocId {
  return `${mapId}/${nodeId}` as DocId;
}

export function splitDocId(docId: DocId): { mapId: string; nodeId: string } {
  const separator = docId.indexOf("/");
  if (separator <= 0) {
    throw new Error(`Invalid docId: ${docId}`);
  }
  return {
    mapId: docId.slice(0, separator),
    nodeId: docId.slice(separator + 1),
  };
}

export function asBlockId(value: string): BlockId {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(value)) {
    throw new Error(`Invalid blockId: ${value}`);
  }
  return value as BlockId;
}

export function asBoardId(value: string): BoardId {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(value)) {
    throw new Error(`Invalid boardId: ${value}`);
  }
  return value as BoardId;
}

export function asBoardItemId(value: string): BoardItemId {
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(value)) {
    throw new Error(`Invalid boardItemId: ${value}`);
  }
  return value as BoardItemId;
}
