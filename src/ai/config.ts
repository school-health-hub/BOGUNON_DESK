import type { AiProvider } from "./types";

export type AiModelDefinition = {
  readonly id: string;
  readonly label: string;
};

export type AiProviderDefinition = {
  readonly id: AiProvider;
  readonly label: string;
  readonly models: readonly [AiModelDefinition, ...AiModelDefinition[]];
};

export const aiProviderRegistry = {
  openai: {
    id: "openai",
    label: "OpenAI",
    models: [
      { id: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
      { id: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
      { id: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
    ],
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
      { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash" },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite" },
    ],
  },
} as const satisfies Record<AiProvider, AiProviderDefinition>;

export const aiProviderDefinitions = [
  aiProviderRegistry.openai,
  aiProviderRegistry.gemini,
] as const;

export const getDefaultAiModel = (provider: AiProvider): string =>
  aiProviderRegistry[provider].models[0].id;

export const isAllowedAiModel = (provider: AiProvider, model: string): boolean =>
  aiProviderRegistry[provider].models.some((definition) => definition.id === model);
