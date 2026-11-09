import { useEffect } from "react";
import { create } from "zustand";
import { Icon } from "./Icon";

export type MessageTone = "info" | "success" | "warning" | "error";

type MessageItem = {
  id: number;
  text: string;
  tone: MessageTone;
  duration: number;
};

type MessageStore = {
  items: MessageItem[];
  push: (text: string, tone: MessageTone, duration: number) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;
const DEFAULT_DURATION_MS = 3000;
const MAX_VISIBLE = 4;

const useMessageStore = create<MessageStore>((set) => ({
  items: [],
  push: (text, tone, duration) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    const id = nextId++;
    set((state) => {
      if (
        state.items.some(
          (item) => item.text === trimmed && item.tone === tone,
        )
      ) {
        return state;
      }
      return {
        items: [
          ...state.items,
          { id, text: trimmed, tone, duration },
        ].slice(-MAX_VISIBLE),
      };
    });
  },
  dismiss: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
}));

function push(text: string, tone: MessageTone, duration = DEFAULT_DURATION_MS) {
  useMessageStore.getState().push(text, tone, duration);
}

export const message = {
  show(text: string, tone: MessageTone = "info", duration?: number) {
    push(text, tone, duration);
  },
  success(text: string, duration?: number) {
    push(text, "success", duration);
  },
  info(text: string, duration?: number) {
    push(text, "info", duration);
  },
  warning(text: string, duration?: number) {
    push(text, "warning", duration);
  },
  error(text: string, duration?: number) {
    push(text, "error", duration);
  },
};

const MESSAGE_ICON: Record<MessageTone, "check" | "close" | "alert" | "info"> = {
  success: "check",
  error: "close",
  warning: "alert",
  info: "info",
};

function MessageRow({ item }: { item: MessageItem }) {
  const dismiss = useMessageStore((state) => state.dismiss);
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(item.id), item.duration);
    return () => window.clearTimeout(timer);
  }, [dismiss, item.duration, item.id]);

  return (
    <div
      className={["ui-message", `ui-message-${item.tone}`].join(" ")}
      role="status"
      aria-live="polite"
    >
      <Icon name={MESSAGE_ICON[item.tone]} size={14} />
      <span>{item.text}</span>
    </div>
  );
}

export function MessageHost() {
  const items = useMessageStore((state) => state.items);
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="ui-message-region" aria-label="消息">
      {items.map((item) => (
        <MessageRow key={item.id} item={item} />
      ))}
    </div>
  );
}
