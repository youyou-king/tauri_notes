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
import type { DockWorkspaceHandle } from "../components/DockWorkspace";
import { openSettings } from "../ui/settings/settingsEvents";
import { shellActions } from "../ui/shell/shellActions";

type CommandRunnerDeps = {
  busy: boolean;
  hasWorkspace: boolean;
  dockRef: RefObject<DockWorkspaceHandle | null>;
  setError: (value: string | null) => void;
  createKnowledgeBase: () => Promise<unknown> | void;
  openWorkspace: () => Promise<unknown> | void;
  backupLibrary: () => Promise<unknown> | void;
  confirmDiscard: () => Promise<boolean>;
};

export function useAppCommandRunner({
  busy,
  hasWorkspace,
  dockRef,
  setError,
  createKnowledgeBase,
  openWorkspace,
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
        hasWorkspace,
        createKnowledge: () => void createKnowledgeBase(),
        openKnowledge: () => void openWorkspace(),
        backup: () => void backupLibrary(),
        toggleOutline: () => dockRef.current?.togglePanel("outline"),
        toggleConsole: () => dockRef.current?.togglePanel("console"),
        clearLayout: () => {
          void confirmDiscard().then((confirmed) => {
            if (confirmed) {
              dockRef.current?.clearLayout();
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
      openWorkspace,
      confirmDiscard,
      setError,
      hasWorkspace,
    ],
  );
}

type HotkeyDeps = {
  hasWorkspace: boolean;
  board: BoardControllerPort;
  dockRef: RefObject<DockWorkspaceHandle | null>;
  setError: (value: string | null) => void;
};

export function useAppHotkeys({
  hasWorkspace,
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
      hasWorkspace,
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
        hasWorkspace,
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
  }, [board.openBoard, dockRef, keymap, setError, hasWorkspace]);
}
