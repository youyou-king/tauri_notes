export const DOCK_LAYOUT_KEY = "tauri-notes.dock-layout.v21";

export function resetDockLayout(): void {
  try {
    window.localStorage.removeItem(DOCK_LAYOUT_KEY);
  } catch {
    // localStorage can be unavailable in hardened WebViews.
  }
}
