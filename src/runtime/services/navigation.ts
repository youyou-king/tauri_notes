import type { NavigationPort } from "../../application/ports/navigationPort";
import { useMobileShellStore } from "../../application/stores/mobileShellStore";
import { APP_EVENTS, emitAppEvent } from "../../kernel/events";

function saveIfEditing(): void {
  if (useMobileShellStore.getState().editing) {
    emitAppEvent(APP_EVENTS.saveNow);
  }
}

export function createMobileNavigation(): NavigationPort {
  return {
    back() {
      saveIfEditing();
      return useMobileShellStore.getState().back();
    },
    openDocument(documentId) {
      saveIfEditing();
      useMobileShellStore.getState().openDocument(documentId);
    },
    canGoBack() {
      return useMobileShellStore.getState().history.length > 0;
    },
  };
}

export function createDesktopNavigation(): NavigationPort {
  return {
    back() {
      return false;
    },
    openDocument() {
      // Desktop panels are opened by WorkspacePresenter/Dockview.
    },
    canGoBack() {
      return false;
    },
  };
}