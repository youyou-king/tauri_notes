import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./ui/theme/ThemeProvider";
import "dockview-react/dist/styles/dockview.css";
import "@xyflow/react/dist/style.css";
import "./ui/design-system/tokens/tokens.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
