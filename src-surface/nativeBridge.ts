import type { SurfaceProjection } from "./projection";

export const approvedSurfaceActionIds = ["official-document", "purchase-helper", "record-helper", "home"] as const;
export type ApprovedSurfaceActionId = (typeof approvedSurfaceActionIds)[number];
export const surfaceEditCommands = ["BeginEdit", "CompleteEdit", "CancelEdit"] as const;
export type SurfaceEditCommandName = (typeof surfaceEditCommands)[number];
export type SurfaceEditControl = Readonly<{ sequence: number; command: SurfaceEditCommandName }>;

type WebViewMessageEvent = Readonly<{ data: unknown }>;
type WebViewTransport = Readonly<{
  addEventListener: (type: "message", listener: (event: WebViewMessageEvent) => void) => void;
  removeEventListener: (type: "message", listener: (event: WebViewMessageEvent) => void) => void;
  postMessage: (message: string) => void;
}>;

export type SurfaceNativeBridge = Readonly<{
  requestProjection: () => void;
  openMain: (actionId: string) => boolean;
  notifyRendererReady: () => boolean;
  subscribe: (listener: (projection: SurfaceProjection) => void) => () => void;
  subscribeEditControls: (listener: (control: SurfaceEditControl) => void) => () => void;
}>;

export const rendererRuntimeStages = [
  "html_document_loaded",
  "diagnostic_bootstrap_started",
  "module_load_error",
  "csp_blocked",
  "javascript_error",
  "script_started",
  "react_mount_complete",
  "bridge_initialized",
  "bridge_unavailable",
  "projection_request_attempted",
  "projection_applied",
  "ready_post_attempted",
] as const;
export type RendererRuntimeStage = (typeof rendererRuntimeStages)[number];

export function markRendererRuntimeStage(document: Document, stage: RendererRuntimeStage): boolean {
  const root = document.getElementById("surface-root");
  if (root === null) return false;
  root.dataset.runtimeStage = stage;
  return true;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isNullableString = (value: unknown): value is string | null => value === null || isString(value);
const isSurfaceEditCommand = (value: unknown): value is SurfaceEditCommandName =>
  typeof value === "string" && surfaceEditCommands.some((candidate) => candidate === value);

function isSurfaceProjection(value: unknown): value is SurfaceProjection {
  if (!isRecord(value) || value.kind !== "synthetic-preview" || !isString(value.generatedAt)) return false;
  if (!Array.isArray(value.calendarEvents) || !value.calendarEvents.every((item) =>
    isRecord(item) && isString(item.date) && isString(item.kind) && isString(item.label))) return false;
  if (!Array.isArray(value.tasks) || !value.tasks.every((item) =>
    isRecord(item) && isString(item.id) && isString(item.label) && isNullableString(item.dueDate)
      && typeof item.completed === "boolean" && typeof item.order === "number")) return false;
  if (!Array.isArray(value.ddays) || !value.ddays.every((item) =>
    isRecord(item) && isString(item.id) && isString(item.label) && isString(item.targetDate)
      && typeof item.remainingDays === "number" && isString(item.kind))) return false;
  if (!isRecord(value.weather) || !isString(value.weather.state)
    || !(value.weather.temperatureCelsius === null || typeof value.weather.temperatureCelsius === "number")
    || !isNullableString(value.weather.condition) || !isNullableString(value.weather.iconCode)
    || !isNullableString(value.weather.updatedAt)) return false;
  return Array.isArray(value.launchers) && value.launchers.every((item) =>
    isRecord(item) && isString(item.actionId) && isApprovedSurfaceActionId(item.actionId)
      && isString(item.label) && isString(item.icon));
}

export const isApprovedSurfaceActionId = (value: string): value is ApprovedSurfaceActionId =>
  approvedSurfaceActionIds.some((candidate) => candidate === value);

export function parseSurfaceGeneration(search: string): number | null {
  const raw = new URLSearchParams(search).get("generation");
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function createSurfaceNativeBridge(webview: WebViewTransport, generation: number): SurfaceNativeBridge {
  let sequence = 0;
  let rendererReadySent = false;
  const nextRequest = (command: "OpenMain" | "RefreshProjection" | "RendererReady") => JSON.stringify({
    generation,
    sequence: ++sequence,
    command,
  });

  return {
    requestProjection: () => webview.postMessage(nextRequest("RefreshProjection")),
    notifyRendererReady: () => {
      if (rendererReadySent) return false;
      rendererReadySent = true;
      webview.postMessage(nextRequest("RendererReady"));
      return true;
    },
    openMain: (actionId) => {
      if (!isApprovedSurfaceActionId(actionId)) return false;
      webview.postMessage(nextRequest("OpenMain"));
      return true;
    },
    subscribe: (listener) => {
      const handler = (event: WebViewMessageEvent) => {
        if (!isRecord(event.data) || event.data.kind !== "SurfaceProjection") return;
        const projection = event.data.projection;
        if (isSurfaceProjection(projection)) listener(projection);
      };
      webview.addEventListener("message", handler);
      return () => webview.removeEventListener("message", handler);
    },
    subscribeEditControls: (listener) => {
      let lastSequence = 0;
      const handler = (event: WebViewMessageEvent) => {
        if (!isRecord(event.data) || event.data.kind !== "SurfaceEditControl"
          || event.data.generation !== generation || typeof event.data.sequence !== "number"
          || !Number.isSafeInteger(event.data.sequence) || event.data.sequence <= lastSequence
          || !isSurfaceEditCommand(event.data.command)) return;
        lastSequence = event.data.sequence;
        listener({ sequence: event.data.sequence, command: event.data.command });
      };
      webview.addEventListener("message", handler);
      return () => webview.removeEventListener("message", handler);
    },
  };
}

export function getWebViewTransport(scope: Window): WebViewTransport | null {
  const candidate = (scope as Window & { chrome?: { webview?: WebViewTransport } }).chrome?.webview;
  return candidate ?? null;
}
