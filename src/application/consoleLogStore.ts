import { create } from "zustand";

export type ConsoleCategory =
  | "command"
  | "workspace"
  | "panel"
  | "document"
  | "theme"
  | "action"
  | "system";

export type ConsoleEvent = {
  id: number;
  at: number;
  category: ConsoleCategory;
  action: string;
  detail?: string;
};

type ConsoleLogStore = {
  events: ConsoleEvent[];
  record: (category: ConsoleCategory, action: string, detail?: string) => void;
  clear: () => void;
};

let nextId = 1;

export const useConsoleLogStore = create<ConsoleLogStore>((set) => ({
  events: [],
  record: (category, action, detail) => {
    const event: ConsoleEvent = {
      id: nextId++,
      at: Date.now(),
      category,
      action,
      detail,
    };
    set((state) => ({
      events: [...state.events.slice(-499), event],
    }));
  },
  clear: () => set({ events: [] }),
}));

export function recordConsoleEvent(
  category: ConsoleCategory,
  action: string,
  detail?: string,
): void {
  useConsoleLogStore.getState().record(category, action, detail);
}
