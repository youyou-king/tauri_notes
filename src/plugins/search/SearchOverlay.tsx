import { useEffect, useSyncExternalStore } from "react";
import { useWorkspacePort } from "../../ui/sdk";
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
    const handler = () => openSearchOverlay();
    window.addEventListener("search:open", handler);
    return () => window.removeEventListener("search:open", handler);
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
