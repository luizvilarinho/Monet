import { getCurrentWindow } from "@tauri-apps/api/window";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AssistantPanel } from "./components/AssistantPanel/AssistantPanel";

const isAssistantWindow = getCurrentWindow().label === "assistant";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isAssistantWindow ? <AssistantPanel /> : <App />}
  </React.StrictMode>,
);
