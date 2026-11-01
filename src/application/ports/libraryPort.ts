/**
 * Platform-neutral file/library boundary. Desktop returns external `.note`
 * paths; mobile will later return managed-library ids while the shell stays
 * unchanged.
 */
export type LibraryPort = {
  /** Ask the user to pick an existing library. Null means cancelled. */
  pickExisting(): Promise<string | null>;
  /** Ask the user where to create a new library. Null means cancelled. */
  pickNew(title?: string): Promise<string | null>;
  /**
   * True when the adapter stores libraries inside App-private storage (mobile)
   * and therefore needs a title before creating the path.
   */
  readonly managed?: boolean;
};