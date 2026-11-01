/**
 * Shell navigation boundary. Desktop implementations may be no-ops today;
 * mobile implementations own the back stack and document opening.
 */
export type NavigationPort = {
  back(): boolean;
  openDocument(documentId: string): void;
  canGoBack(): boolean;
};