import type { WorkspaceView } from "../../types";

/**
 * Shell-side presentation callbacks. The application layer calls
 * WorkspacePresenter without knowing whether the target is Dockview or the
 * mobile navigation stack.
 */
export type WorkspacePresenterHandlers = {
  present(view: WorkspaceView, isNote: boolean): void;
  resetLayout(): void;
  activatePanel(panelId: string): void;
};

export type WorkspacePresenter = {
  bind(handlers: WorkspacePresenterHandlers | null): void;
  present(view: WorkspaceView, isNote: boolean): void;
  resetLayout(): void;
  activatePanel(panelId: string): void;
};