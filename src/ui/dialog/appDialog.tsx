import { useState, type ReactNode } from "react";
import { create } from "zustand";
import { Button } from "../design-system/Button";
import { Dialog } from "./Dialog";

export type ConfirmDialogOptions = {
  title: string;
  message: ReactNode;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

export type PromptDialogOptions = {
  title: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
};

export type AlertDialogOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
};

type PendingConfirm = {
  id: number;
  kind: "confirm";
  options: ConfirmDialogOptions;
  resolve: (value: boolean) => void;
};

type PendingPrompt = {
  id: number;
  kind: "prompt";
  options: PromptDialogOptions;
  resolve: (value: string | null) => void;
};

type PendingAlert = {
  id: number;
  kind: "alert";
  options: AlertDialogOptions;
  resolve: () => void;
};

type PendingDialog = PendingConfirm | PendingPrompt | PendingAlert;

type DialogStore = {
  pending: PendingDialog[];
  enqueue: (dialog: PendingDialog) => void;
  settleConfirm: (id: number, value: boolean) => void;
  settlePrompt: (id: number, value: string | null) => void;
  settleAlert: (id: number) => void;
};

let nextId = 1;

function removePending(pending: PendingDialog[], id: number) {
  return pending.filter((item) => item.id !== id);
}

export const useAppDialogStore = create<DialogStore>((set, get) => ({
  pending: [],
  enqueue: (dialog) =>
    set((state) => ({ pending: [...state.pending, dialog] })),
  settleConfirm: (id, value) => {
    const current = get().pending.find((item) => item.id === id);
    if (!current || current.kind !== "confirm") {
      return;
    }
    set((state) => ({ pending: removePending(state.pending, id) }));
    current.resolve(value);
  },
  settlePrompt: (id, value) => {
    const current = get().pending.find((item) => item.id === id);
    if (!current || current.kind !== "prompt") {
      return;
    }
    set((state) => ({ pending: removePending(state.pending, id) }));
    current.resolve(value);
  },
  settleAlert: (id) => {
    const current = get().pending.find((item) => item.id === id);
    if (!current || current.kind !== "alert") {
      return;
    }
    set((state) => ({ pending: removePending(state.pending, id) }));
    current.resolve();
  },
}));

export function confirmDialog(
  options: ConfirmDialogOptions,
): Promise<boolean> {
  return new Promise((resolve) => {
    useAppDialogStore.getState().enqueue({
      id: nextId++,
      kind: "confirm",
      options,
      resolve,
    });
  });
}

export function promptDialog(
  options: PromptDialogOptions,
): Promise<string | null> {
  return new Promise((resolve) => {
    useAppDialogStore.getState().enqueue({
      id: nextId++,
      kind: "prompt",
      options,
      resolve,
    });
  });
}

export function alertDialog(options: AlertDialogOptions): Promise<void> {
  return new Promise((resolve) => {
    useAppDialogStore.getState().enqueue({
      id: nextId++,
      kind: "alert",
      options,
      resolve,
    });
  });
}

function ConfirmView({ current }: { current: PendingConfirm }) {
  const { options } = current;
  return (
    <Dialog
      title={options.title}
      eyebrow={options.eyebrow}
      onClose={() => useAppDialogStore.getState().settleConfirm(current.id, false)}
      width={420}
      footer={
        <>
          <Button
            onClick={() =>
              useAppDialogStore.getState().settleConfirm(current.id, false)
            }
          >
            {options.cancelLabel ?? "取消"}
          </Button>
          <Button
            variant={options.tone === "danger" ? "danger" : "primary"}
            data-autofocus
            onClick={() =>
              useAppDialogStore.getState().settleConfirm(current.id, true)
            }
          >
            {options.confirmLabel ?? "确定"}
          </Button>
        </>
      }
    >
      <div className="app-dialog-message">{options.message}</div>
    </Dialog>
  );
}

function PromptView({ current }: { current: PendingPrompt }) {
  const [value, setValue] = useState(current.options.defaultValue ?? "");
  const submit = () => {
    const next = value.trim();
    if (next) {
      useAppDialogStore.getState().settlePrompt(current.id, next);
    }
  };
  return (
    <Dialog
      title={current.options.title}
      onClose={() =>
        useAppDialogStore.getState().settlePrompt(current.id, null)
      }
      width={420}
      footer={
        <>
          <Button
            onClick={() =>
              useAppDialogStore.getState().settlePrompt(current.id, null)
            }
          >
            取消
          </Button>
          <Button
            variant="primary"
            disabled={!value.trim()}
            onClick={submit}
          >
            {current.options.confirmLabel ?? "确定"}
          </Button>
        </>
      }
    >
      <label className="app-dialog-field">
        <span>名称</span>
        <input
          className="app-dialog-input"
          data-autofocus
          value={value}
          placeholder={current.options.placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
      </label>
    </Dialog>
  );
}

function AlertView({ current }: { current: PendingAlert }) {
  return (
    <Dialog
      title={current.options.title ?? "提示"}
      onClose={() => useAppDialogStore.getState().settleAlert(current.id)}
      width={420}
      footer={
        <Button
          variant="primary"
          data-autofocus
          onClick={() => useAppDialogStore.getState().settleAlert(current.id)}
        >
          {current.options.confirmLabel ?? "确定"}
        </Button>
      }
    >
      <div className="app-dialog-message">{current.options.message}</div>
    </Dialog>
  );
}

export function AppDialogHost() {
  const current = useAppDialogStore((state) => state.pending[0]);
  if (!current) {
    return null;
  }
  switch (current.kind) {
    case "confirm":
      return <ConfirmView key={current.id} current={current} />;
    case "prompt":
      return <PromptView key={current.id} current={current} />;
    case "alert":
      return <AlertView key={current.id} current={current} />;
  }
}
