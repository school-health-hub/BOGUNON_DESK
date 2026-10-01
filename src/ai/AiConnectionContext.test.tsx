import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AiConnectionProvider, createAiProviderDraft, useAiConnection } from "./AiConnectionContext";
import { createAiConnectionService } from "./aiConnectionService";

function StatusProbe() {
  const connection = useAiConnection();
  return <span>{connection.state.status}:{connection.provider}:{connection.model}:{connection.apiKey}</span>;
}

describe("AiConnectionProvider lifecycle", () => {
  it("changes provider, selects its default model, and clears the key draft", () => {
    expect(createAiProviderDraft("gemini")).toEqual({
      provider: "gemini",
      model: "gemini-3.8-flash",
      apiKey: "",
    });
  });

  it("mounts with a disconnected, empty, provider-specific draft", () => {
    const createService = () => createAiConnectionService(vi.fn());
    const first = renderToStaticMarkup(<AiConnectionProvider createService={createService}><StatusProbe /></AiConnectionProvider>);
    const second = renderToStaticMarkup(<AiConnectionProvider createService={createService}><StatusProbe /></AiConnectionProvider>);
    expect(first).toContain("disconnected:openai:gpt-5.6-luna:");
    expect(second).toContain("disconnected:openai:gpt-5.6-luna:");
  });
});
