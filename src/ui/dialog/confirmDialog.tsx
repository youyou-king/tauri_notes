import type { ReactNode } from "react";
import { create } from "zustand";
import { Dialog } from "./Dialog";

export type ConfirmDialogOptions = {
  title: string;
  message: ReactNode;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type PendingConfirm = {
  id: number;
  options: ConfirmDialogOptions;
  resolve: (value: boolean) => void;
};

type ConfirmDialogStore = {
  pending: PendingConfirm[];
  request: (options: ConfirmDialogOptions) => Promise<boolean>;
  resolve: (value: boolean) => void;
};

let nextId = 1;

export const useConfirmDialogStore = create<ConfirmDialogStore>((set, get) => ({
  pending: [],
  request: (options) =>
    new Promise<boolean>((resolve) => {
      set((state) => ({
        pending: [...state.pending, { id: nextId++, options, resolve }],
      }));
    }),
  resolve: (value) => {
    const [current, ...rest] = get().pending;
    if (!current) {
      return;
    }
    set({ pending: rest });
    current.resolve(value);
  },
}));

export function confirmDialog(
  options: ConfirmDialogOptions,
): Promise<boolean> {
  return useConfirmDialogStore.getState().request(options);
}

export function ConfirmDialogHost() {
  const current = useConfirmDialogStore((state) => state.pending[0]);
  const resolve = useConfirmDialogStore((state) => state.resolve);
  if (!current) {
    return null;
  }
  return (
    <Dialog
      title={current.options.title}
      eyebrow={current.options.eyebrow}
      onClose={() => resolve(false)}
      width={420}
      footer={
        <>
          <button type="button" onClick={() => resolve(false)}>
            {current.options.cancelLabel ?? "取消"}
          </button>
          <button
            type="button"
            className={
              current.options.tone === "danger" ? "danger" : "primary"
            }
            data-autofocus
            onClick={() => resolve(true)}
          >
            {current.options.confirmLabel ?? "确定"}
          </button>
        </>
      }
    >
      <div className="app-dialog-message">{current.options.message}</div>
    </Dialog>
  );
}
