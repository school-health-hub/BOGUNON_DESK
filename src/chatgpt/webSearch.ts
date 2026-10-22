import { invoke, isTauri } from "@tauri-apps/api/core";
import { ChatGptPlanRequestError, normalizeChatGptPlanError } from "./chatgptPlanService";

export type WebSearchResult = {
  readonly text: string;
  readonly sources: readonly { readonly url: string; readonly title: string }[];
  readonly checkedAt: string;
};

export const supportedWebSearchModel = (model: string): boolean =>
  ["gpt-6-astra", "gpt-6.1-sol", "gpt-6-sol", "gpt-5.6-luna"].includes(model);

export const parseWebSearchResult = (value: unknown): WebSearchResult => {
  if (typeof value !== "object" || value === null || !("text" in value) || typeof value.text !== "string"
    || !("checkedAt" in value) || typeof value.checkedAt !== "string" || !Number.isFinite(Date.parse(value.checkedAt))
    || !("sources" in value) || !Array.isArray(value.sources) || value.sources.length === 0) {
    throw new ChatGptPlanRequestError("invalidResponse");
  }
  const sources = value.sources.map((source: unknown) => {
    if (typeof source !== "object" || source === null || !("url" in source) || typeof source.url !== "string"
      || !("title" in source) || typeof source.title !== "string") throw new ChatGptPlanRequestError("invalidResponse");
    let url: URL;
    try { url = new URL(source.url); } catch { throw new ChatGptPlanRequestError("invalidResponse"); }
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "") throw new ChatGptPlanRequestError("invalidResponse");
    return { url: url.href, title: source.title };
  });
  return { text: value.text, checkedAt: value.checkedAt, sources };
};

export async function searchChatGptWebNative(model: string, prompt: string): Promise<WebSearchResult> {
  if (!isTauri() || !supportedWebSearchModel(model)) throw new ChatGptPlanRequestError("unavailable");
  try { return parseWebSearchResult(await invoke<unknown>("chatgpt_search_web", { model, prompt })); }
  catch (error: unknown) { throw new ChatGptPlanRequestError(normalizeChatGptPlanError(error).code); }
}
