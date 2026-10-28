export {};

declare global {
  interface Window {
    __TAURI_WORKSPACE_ROOT__?: string;
  }
}
