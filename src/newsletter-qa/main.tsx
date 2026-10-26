import React from "react"
import ReactDOM from "react-dom/client"
import { NewsletterQaApp } from "./NewsletterQaApp"

const root = document.getElementById("root")
if (root === null) throw new Error("Newsletter QA root element is missing")
ReactDOM.createRoot(root).render(<React.StrictMode><NewsletterQaApp /></React.StrictMode>)
