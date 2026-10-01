import { describe, expect, it } from "vitest";
import { aiProviderRegistry, getDefaultAiModel, isAllowedAiModel } from "./config";

describe("AI provider registry", () => {
  it("selects a provider-specific default model", () => {
    expect(getDefaultAiModel("openai")).toBe("gpt-5.6-luna");
    expect(getDefaultAiModel("gemini")).toBe("gemini-3.8-flash");
  });

  it("allows only registered models for each provider", () => {
    expect(isAllowedAiModel("openai", aiProviderRegistry.openai.models[1].id)).toBe(true);
    expect(isAllowedAiModel("gemini", aiProviderRegistry.gemini.models[1].id)).toBe(true);
    expect(isAllowedAiModel("openai", "gemini-3.8-flash")).toBe(false);
    expect(isAllowedAiModel("gemini", "custom-model")).toBe(false);
  });
});
