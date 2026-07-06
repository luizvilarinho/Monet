import { getCurrentWindow } from "@tauri-apps/api/window";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AssistantPanel } from "./components/AssistantPanel/AssistantPanel";
import { KeepPanel } from "./components/KeepPanel/KeepPanel";

const windowLabel = getCurrentWindow().label;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {windowLabel === "assistant" ? (
      <AssistantPanel />
    ) : windowLabel === "keep" ? (
      <KeepPanel />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
