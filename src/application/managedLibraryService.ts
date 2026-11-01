import { invoke } from "@tauri-apps/api/core";

export type ManagedLibrarySummary = {
  id: string;
  title: string;
  path: string;
};

/**
 * Mobile/App-private library commands. Desktop can call them too, but the
 * normal desktop flow remains external `.note` paths.
 */
export const managedLibraryService = {
  list(): Promise<ManagedLibrarySummary[]> {
    return invoke<ManagedLibrarySummary[]>("list_managed_libraries");
  },
  import(source: string): Promise<ManagedLibrarySummary> {
    return invoke<ManagedLibrarySummary>("import_managed_library", { source });
  },
};