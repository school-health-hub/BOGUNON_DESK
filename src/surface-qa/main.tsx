import "@fontsource/pretendard/400.css";
import "@fontsource/pretendard/500.css";
import "@fontsource/pretendard/600.css";
import "@fontsource/pretendard/700.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { SurfaceQaMain } from "./SurfaceQaMain";
import "./surface-qa.css";

const root = document.getElementById("surface-qa-root");
if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <SurfaceQaMain sourceSha={import.meta.env.VITE_SURFACE_QA_SOURCE_SHA ?? "NOT_BUILT"} />
    </StrictMode>,
  );
}
