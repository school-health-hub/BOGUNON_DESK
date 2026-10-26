import React from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import "../styles/base.css";
import "../styles/dashboard.css";
import "../styles/components.css";
import "../styles/desktop-workspace.css";
import "../education-video/aiFinder.css";
import { FinderIntegrationQaApp } from "./FinderIntegrationQaApp";

declare global {
  interface Window {
    __FINDER_INTEGRATION_QA__: Readonly<{
      info: () => Promise<unknown>;
      exportLibrary: () => Promise<unknown>;
    }>;
  }
}

Object.defineProperty(window, "__FINDER_INTEGRATION_QA__", {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({
    info: () => invoke("finder_integration_qa_info"),
    exportLibrary: () => invoke("education_video_library_export"),
  }),
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><FinderIntegrationQaApp /></React.StrictMode>,
);
