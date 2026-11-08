import type { LibraryPath } from "../../types";

/**
 * Platform-neutral library location picker. Picking returns a location for the
 * import/open flow; identity comes from workspace metadata via register_library.
 */
export type LibraryPort = {
  /** Ask the user to pick an existing library. Null means cancelled. */
  pickExisting(): Promise<LibraryPath | null>;
  /** Ask the user where to create a new library. Null means cancelled. */
  pickNew(title?: string): Promise<LibraryPath | null>;
  /**
   * True when the adapter stores libraries inside App-private storage (mobile)
   * and therefore needs a title before creating the path.
   */
  readonly managed?: boolean;
  /** Export an open library to a user-selected destination. */
  exportLibrary?(source: LibraryPath): Promise<LibraryPath | null>;
};