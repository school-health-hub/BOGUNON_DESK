import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/base.css";
import "../styles/dashboard.css";
import "../styles/components.css";
import "../styles/desktop-workspace.css";
import "../education-video/aiFinder.css";
import { FinderIntegrationQaApp } from "./FinderIntegrationQaApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><FinderIntegrationQaApp /></React.StrictMode>,
);
