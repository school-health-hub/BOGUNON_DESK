import React from "react";
import ReactDOM from "react-dom/client";
import { OfficialDocumentQaApp } from "./OfficialDocumentQaApp";
import "../styles/base.css";
import "../styles/components.css";
import "../styles/desktop-workspace.css";
import "./official-document-qa.css";

const root = document.getElementById("root");
if (root === null) throw new Error("QA 화면을 시작하지 못했습니다.");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <OfficialDocumentQaApp />
  </React.StrictMode>,
);
