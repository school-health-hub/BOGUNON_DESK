import "@fontsource/pretendard/400.css";
import "@fontsource/pretendard/500.css";
import "@fontsource/pretendard/600.css";
import "@fontsource/pretendard/700.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SurfaceApp } from "./SurfaceApp";
import { createSessionStorageAdapter, editedSurfaceLayout } from "./layout";
import { syntheticSurfaceProjection } from "./projection";
import "./surface.css";

const root = document.getElementById("surface-root");
if (root !== null) {
  const editingPreview = new URLSearchParams(window.location.search).get("preview") === "editing";
  createRoot(root).render(<StrictMode><SurfaceApp projection={syntheticSurfaceProjection} storage={createSessionStorageAdapter(window.sessionStorage)}
    initialEditing={editingPreview} initialLayout={editingPreview ? editedSurfaceLayout : undefined} /></StrictMode>);
}
