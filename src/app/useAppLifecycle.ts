import { useEffect, type RefObject } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { workspaceService } from "../application/workspaceService";
import { confirmDialog } from "../ui/dialog/confirmDialog";

export function useWindowTitle(dirtyCount: number): void {
  useEffect(() => {
    void getCurrentWindow().setTitle(
      dirtyCount > 0 ? "● Tauri Notes" : "Tauri Notes",
    );
  }, [dirtyCount]);
}

export function useWindowCloseGuard(
  dirtyRef: RefObject<number>,
): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    getCurrentWindow()
      .onCloseRequested((event) => {
        if (dirtyRef.current === 0) {
          return;
        }
        event.preventDefault();
        void confirmDialog({
          title: "关闭 Tauri Notes？",
          message: "关闭会丢失未保存的修改，仍要关闭吗？",
          confirmLabel: "关闭",
          tone: "danger",
        }).then((confirmed) => {
          if (confirmed) {
            void getCurrentWindow().destroy();
          }
        });
      })
      .then((fn) => {
        if (disposed) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [dirtyRef]);
}

export function usePendingNoteFile({
  sessionReady,
  openOnlyWorkspace,
  restoreSession,
  resetLayout,
  setError,
}: {
  sessionReady: RefObject<boolean>;
  openOnlyWorkspace: (path: string) => Promise<unknown>;
  restoreSession: () => Promise<boolean>;
  resetLayout: () => void;
  setError: (message: string) => void;
}): void {
  useEffect(() => {
    let cancelled = false;
    let initialized = false;
    let handling = false;
    let timer: number | undefined;

    const stopPolling = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const tick = async () => {
      if (cancelled || handling) {
        return;
      }
      handling = true;
      try {
        const path = await workspaceService.takePendingNoteFile();
        if (cancelled) {
          return;
        }
        if (path) {
          initialized = true;
          stopPolling();
          sessionReady.current = true;
          await openOnlyWorkspace(path);
          return;
        }
        if (!initialized) {
          initialized = true;
          stopPolling();
          const restored = await restoreSession();
          sessionReady.current = true;
          if (!restored) {
            resetLayout();
          }
        }
      } catch (reason) {
        setError(String(reason));
      } finally {
        handling = false;
      }
    };

    timer = window.setInterval(() => {
      void tick();
    }, 800);
    void tick();
    const unlisten = listen<string>("open-note-file", () => {
      void tick();
    });
    return () => {
      cancelled = true;
      stopPolling();
      void unlisten.then((stop) => stop());
    };
    // Startup only: callbacks are intentionally read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useNoteDrop(
  openOnlyWorkspace: (path: string) => Promise<unknown>,
): void {
  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if ([...(event.dataTransfer?.types ?? [])].includes("Files")) {
        event.preventDefault();
      }
    };
    const onDrop = (event: DragEvent) => {
      const file = [...(event.dataTransfer?.files ?? [])].find((item) =>
        /\.note$/i.test(item.name),
      );
      if (!file) {
        return;
      }
      event.preventDefault();
      const path = (file as File & { path?: string }).path;
      if (path) {
        void openOnlyWorkspace(path);
      }
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
    // Startup only: callback is intentionally read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
