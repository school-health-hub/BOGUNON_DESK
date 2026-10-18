function (eventData) {
  const allowed = ["desktop:navigate", "desktop:notice", "desktop:file-drop",
    "purchase:analysis-start", "purchase:analysis", "purchase:analysis-error"];
  if (!allowed.includes(eventData.event)) return false;
  const send = window.__internal_unstable_listeners_function_id__;
  const all = window.__internal_unstable_listeners_object_id__;
  if (typeof send !== "function" || !all) return false;
  const listeners = all[eventData.event];
  if (!listeners) return false;
  const ids = Object.getOwnPropertyNames(listeners).filter((id) => {
    const target = listeners[id].target;
    return Number.isSafeInteger(Number(id)) && target &&
      (target.kind === "Any" || (target.label === "main" &&
        ["AnyLabel", "Window", "Webview", "WebviewWindow"].includes(target.kind)));
  }).map(Number);
  send(eventData, ids);
  return true;
}
