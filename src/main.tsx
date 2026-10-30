import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { ThemeProvider } from "./ui/theme/ThemeProvider";
import { PluginProvider } from "./ui/plugins/PluginProvider";
import { AppearanceHost } from "./plugins/theme/AppearanceHost";
import { WorkspaceBridge } from "./ui/sdk";
import "./styles.layered.css";

const LAST_ERROR_KEY = "tauri-notes.last-runtime-error";

function recordRuntimeError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Tauri Notes runtime error", error);
  try {
    window.localStorage.setItem(
      LAST_ERROR_KEY,
      JSON.stringify({
        message,
        stack: error instanceof Error ? error.stack : undefined,
        at: new Date().toISOString(),
      }),
    );
  } catch {
    // Diagnostics must never break startup.
  }
}

window.addEventListener("error", (event) => recordRuntimeError(event.error));
window.addEventListener("unhandledrejection", (event) =>
  recordRuntimeError(event.reason),
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <WorkspaceBridge>
          <AppearanceHost />
          <PluginProvider>
            <App />
          </PluginProvider>
        </WorkspaceBridge>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

document.getElementById("boot-fallback")?.remove();
