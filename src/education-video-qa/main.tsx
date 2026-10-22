import React from "react";
import ReactDOM from "react-dom/client";
import { EducationVideoQaApp } from "./EducationVideoQaApp";

const root = document.getElementById("root");
if (root === null) throw new Error("Finder QA root is unavailable");
ReactDOM.createRoot(root).render(<React.StrictMode><EducationVideoQaApp /></React.StrictMode>);
