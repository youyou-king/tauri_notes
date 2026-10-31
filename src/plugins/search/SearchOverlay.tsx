import { useEffect, useSyncExternalStore } from "react";
import { useWorkspacePort } from "../../ui/sdk";
import { APP_EVENTS, onAppEvent } from "../../kernel/sdk";
import { openSearchHit } from "../../app/searchNavigation";
import SearchPalette from "./SearchPalette";
import {
  closeSearchOverlay,
  getSearchOverlaySnapshot,
  openSearchOverlay,
  subscribeSearchOverlay,
} from "./searchOverlayStore";

export function SearchOverlay() {
  const open = useSyncExternalStore(
    subscribeSearchOverlay,
    getSearchOverlaySnapshot,
  );
  const { activeWorkspace } = useWorkspacePort();

  useEffect(() => {
    return onAppEvent(APP_EVENTS.searchOpen, () => openSearchOverlay());
  }, []);

  if (!open || !activeWorkspace) {
    return null;
  }

  return (
    <SearchPalette
      workspace={activeWorkspace}
      onClose={closeSearchOverlay}
      onOpenHit={(hit) => {
        closeSearchOverlay();
        openSearchHit(hit);
      }}
    />
  );
}
