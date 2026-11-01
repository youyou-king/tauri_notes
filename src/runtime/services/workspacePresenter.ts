import type { WorkspacePresenter } from "../../application/ports/workspacePresenterPort";

/**
 * Mutable presenter: the shell binds its concrete handlers on mount, while the
 * application can call presentation methods before/without a shell (mobile
 * uses the no-op default).
 */
export function createWorkspacePresenter(): WorkspacePresenter {
  let handlers: Parameters<WorkspacePresenter["bind"]>[0] = null;

  return {
    bind(next) {
      handlers = next;
    },
    present(view, isNote) {
      handlers?.present(view, isNote);
    },
    resetLayout() {
      handlers?.resetLayout();
    },
    closeWorkspace(root, view) {
      handlers?.closeWorkspace(root, view);
    },
    activatePanel(panelId) {
      handlers?.activatePanel(panelId);
    },
  };
}