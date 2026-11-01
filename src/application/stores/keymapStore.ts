import { create } from "zustand";
import type { KeymapDocument } from "../../kernel/action";
import { keymapService } from "../keymapService";

type KeymapState = {
  document: KeymapDocument | null;
  loading: Promise<void> | null;
  load: () => Promise<void>;
  save: (document: KeymapDocument) => Promise<void>;
};

export const useKeymapStore = create<KeymapState>((set, get) => ({
  document: null,
  loading: null,
  load: () => {
    const loading = get().loading;
    if (loading) {
      return loading;
    }
    const next = keymapService.load().then((document) => {
      set({ document, loading: null });
    });
    set({ loading: next });
    return next;
  },
  save: async (document) => {
    await keymapService.save(document);
    set({ document });
  },
}));