import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
          if (
            id.includes("@tiptap") ||
            id.includes("/node_modules/prosemirror-")
          ) {
            return "editor";
          }
          if (id.includes("@xyflow")) return "react-flow";
          if (id.includes("@codemirror/lang-")) return undefined;
          if (id.includes("@codemirror") || id.includes("/codemirror/")) {
            return "codemirror";
          }
          if (id.includes("dockview")) return "dockview";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**", "**/.webview2/**", "**/.tmp/**"],
    },
  },
});
