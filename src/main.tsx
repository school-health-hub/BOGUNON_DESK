import React from "react";
import ReactDOM from "react-dom/client";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { App } from "./App";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("앱을 표시할 루트 요소를 찾을 수 없습니다.");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
