import "@fontsource/pretendard/400.css";
import "@fontsource/pretendard/500.css";
import "@fontsource/pretendard/600.css";
import "@fontsource/pretendard/700.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { SurfaceApp } from "./SurfaceApp";
import { createSessionStorageAdapter, editedSurfaceLayout } from "./layout";
import { syntheticSurfaceProjection } from "./projection";
import type { SurfaceProjection } from "./projection";
import {
  createSurfaceNativeBridge,
  getWebViewTransport,
  markRendererRuntimeStage,
  parseSurfaceGeneration,
} from "./nativeBridge";
import "./surface.css";

if (typeof document !== "undefined") markRendererRuntimeStage(document, "script_started");

export function SurfaceRoot() {
  const [projection, setProjection] = useState<SurfaceProjection>(syntheticSurfaceProjection);
  const [nativeProjectionApplied, setNativeProjectionApplied] = useState(false);
  const nativeBridge = useMemo(() => {
    const webview = getWebViewTransport(window);
    const generation = parseSurfaceGeneration(window.location.search);
    return webview === null || generation === null ? null : createSurfaceNativeBridge(webview, generation);
  }, []);
  useEffect(() => {
    markRendererRuntimeStage(document, "react_mount_complete");
  }, []);
  useEffect(() => {
    if (nativeBridge === null) {
      markRendererRuntimeStage(document, "bridge_unavailable");
      return undefined;
    }
    markRendererRuntimeStage(document, "bridge_initialized");
    const unsubscribe = nativeBridge.subscribe((nextProjection) => {
      setProjection(nextProjection);
      setNativeProjectionApplied(true);
      markRendererRuntimeStage(document, "projection_applied");
    });
    markRendererRuntimeStage(document, "projection_request_attempted");
    nativeBridge.requestProjection();
    return unsubscribe;
  }, [nativeBridge]);
  useEffect(() => {
    if (nativeBridge !== null && nativeProjectionApplied) {
      markRendererRuntimeStage(document, "ready_post_attempted");
      nativeBridge.notifyRendererReady();
    }
  }, [nativeBridge, nativeProjectionApplied, projection]);
  const editingPreview = new URLSearchParams(window.location.search).get("preview") === "editing";
  return <SurfaceApp projection={projection} storage={createSessionStorageAdapter(window.sessionStorage)}
    onOpenMain={nativeBridge === null ? undefined : (actionId) => { nativeBridge.openMain(actionId); }}
    isBrowserPreview={nativeBridge === null}
    initialEditing={editingPreview} initialLayout={editingPreview ? editedSurfaceLayout : undefined} />;
}

const root = typeof document === "undefined" ? null : document.getElementById("surface-root");
if (root !== null) {
  createRoot(root).render(<StrictMode><SurfaceRoot /></StrictMode>);
}
