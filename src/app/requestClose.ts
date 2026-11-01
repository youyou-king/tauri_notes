import { confirmDialog } from "../ui/dialog/confirmDialog";

export type CloseRequest = {
  kind: "window" | "workspace";
  dirtyCount: number;
};

const MESSAGES = {
  window: {
    title: "关闭 Tauri Notes？",
    message: "关闭会丢失未保存的修改，仍要关闭吗？",
    confirmLabel: "关闭",
  },
  workspace: {
    title: "放弃未保存的修改？",
    message: (dirtyCount: number) =>
      `有 ${dirtyCount} 个面板还有未保存的修改，确定离开吗？`,
    confirmLabel: "放弃修改",
  },
} as const;

export async function requestClose({
  kind,
  dirtyCount,
}: CloseRequest): Promise<boolean> {
  if (dirtyCount === 0) {
    return true;
  }
  const config = MESSAGES[kind];
  return confirmDialog({
    title: config.title,
    message:
      typeof config.message === "function"
        ? config.message(dirtyCount)
        : config.message,
    confirmLabel: config.confirmLabel,
    tone: "danger",
  });
}
