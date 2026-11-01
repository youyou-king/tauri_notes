import { useCallback, useEffect, type RefObject } from "react";
import type { BoardControllerPort } from "../kernel/panel/boardPort";
import {
  applyKeymap,
  createInputRouter,
  listActions,
  resolveInputPlatform,
} from "../kernel/action";
import { useKeymapStore } from "../application/stores/keymapStore";
import { APP_EVENTS, onAppEvent } from "../kernel/events";
import { getCommand, runCommand } from "../kernel/command";
import { recordConsoleEvent } from "../application/consoleLogStore";
import { workspaceService } from "../application/workspaceService";
import type { DockWorkspaceHandle } from "../components/DockWorkspace";
import { openSettings } from "../ui/settings/settingsEvents";
import { shellActions } from "../ui/shell/shellActions";

type CommandRunnerDeps = {
  busy: boolean;
  workspaceRoot: string | null;
  dockRef: RefObject<DockWorkspaceHandle | null>;
  setBackend: (value: string) => void;
  setError: (value: string | null) => void;
  createKnowledgeBase: () => Promise<unknown> | void;
  openWorkspace: () => Promise<unknown> | void;
  openHelp: () => Promise<unknown> | void;
  backupLibrary: () => Promise<unknown> | void;
  confirmDiscard: () => Promise<boolean>;
};

export function useAppCommandRunner({
  busy,
  workspaceRoot,
  dockRef,
  setBackend,
  setError,
  createKnowledgeBase,
  openWorkspace,
  openHelp,
  backupLibrary,
  confirmDiscard,
}: CommandRunnerDeps): (id: string) => void {
  return useCallback(
    (id: string) => {
      const command = getCommand(id);
      if (!command) {
        return;
      }
      recordConsoleEvent("command", command.label, id);
      void runCommand(command, {
        busy,
        hasWorkspace: Boolean(workspaceRoot),
        createKnowledge: () => void createKnowledgeBase(),
        openKnowledge: () => void openWorkspace(),
        openHelp: () => void openHelp(),
        backup: () => void backupLibrary(),
        setAssociation: () => {
          void workspaceService
            .registerNoteAssociation()
            .then(() => setBackend("已设置 .note 文件关联"))
            .catch((reason) => setError(String(reason)));
        },
        clearAssociation: () => {
          void workspaceService
            .unregisterNoteAssociation()
            .then(() => setBackend("已清除 .note 文件关联"))
            .catch((reason) => setError(String(reason)));
        },
        toggleOutline: () => dockRef.current?.togglePanel("outline"),
        toggleConsole: () => dockRef.current?.togglePanel("console"),
        resetLayout: () => {
          void confirmDiscard().then((confirmed) => {
            if (confirmed) {
              dockRef.current?.resetLayout();
            }
          });
        },
        openSettings,
      }).then((result) => {
        if (!result.ok) {
          setError(result.error.message);
          recordConsoleEvent(
            "command",
            `失败：${result.error.message}`,
            id,
          );
        }
      });
    },
    [
      backupLibrary,
      busy,
      createKnowledgeBase,
      dockRef,
      openHelp,
      openWorkspace,
      confirmDiscard,
      setBackend,
      setError,
      workspaceRoot,
    ],
  );
}

type HotkeyDeps = {
  workspaceRoot: string | null;
  board: BoardControllerPort;
  dockRef: RefObject<DockWorkspaceHandle | null>;
  setError: (value: string | null) => void;
};

export function useAppHotkeys({
  workspaceRoot,
  board,
  dockRef,
  setError,
}: HotkeyDeps): void {
  const keymap = useKeymapStore((state) => state.document);
  const loadKeymap = useKeymapStore((state) => state.load);

  useEffect(() => {
    void loadKeymap();
    return onAppEvent(APP_EVENTS.keymapChanged, () => {
      void loadKeymap();
    });
  }, [loadKeymap]);

  useEffect(() => {
    if (!keymap) {
      return;
    }
    const context = {
      hasWorkspace: Boolean(workspaceRoot),
      openBoard: () => {
        board.openBoard();
        dockRef.current?.openBoard();
      },
      openSearch: () => shellActions.openSearch(),
      openSettings,
      openHelp: () => shellActions.openHelp(),
    };
    const router = createInputRouter({
      platform: resolveInputPlatform(),
      actions: applyKeymap(listActions(), keymap),
    });
    function onKeyDown(event: KeyboardEvent) {
      router.handleKeyDown(event, {
        hasWorkspace: Boolean(workspaceRoot),
        runCommand: (id) => {
          const command = getCommand(id);
          if (!command) {
            return;
          }
          recordConsoleEvent("command", command.label, `快捷键 ${id}`);
          void runCommand(command, context).then((result) => {
            if (!result.ok) {
              setError(result.error.message);
              recordConsoleEvent(
                "command",
                `失败：${result.error.message}`,
                command.id,
              );
            }
          });
        },
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [board.openBoard, dockRef, keymap, setError, workspaceRoot]);
}
