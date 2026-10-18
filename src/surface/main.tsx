import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SurfaceRoot } from "./SurfaceRoot";
import "./surface.css";

const container = document.getElementById("surface-root");
if (!container) throw new Error("Surface root element is missing");
createRoot(container).render(<StrictMode><SurfaceRoot /></StrictMode>);
