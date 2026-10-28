export type ImportedDocumentSummary = {
  id: string;
  title: string;
  blockCount: number;
};

export type StoredBlock = {
  id: string;
  documentId: string;
  blockType: string;
  orderKey: string;
  widthSpan: number;
  heightMode: "auto" | "fixed";
  heightPx: number | null;
  contentJson: string;
  plainText: string;
};

export type SaveBlock = {
  id: string;
  blockType: string;
  orderKey: string;
  widthSpan: number;
  heightMode: "auto" | "fixed";
  heightPx: number | null;
  contentJson: string;
  plainText: string;
};
