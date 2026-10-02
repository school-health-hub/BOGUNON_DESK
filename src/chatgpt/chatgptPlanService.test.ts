import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateChatGptTextNative,
  listChatGptModelsNative,
  normalizeChatGptPlanError,
  parseChatGptModels,
} from "./chatgptPlanService";

const tauri = vi.hoisted(() => ({
  invoke: vi.fn<(command: string, args?: Readonly<Record<string, string>>) => Promise<unknown>>(),
  isTauri: vi.fn<() => boolean>(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauri.invoke,
  isTauri: tauri.isTauri,
}));

describe("ChatGPT plan frontend service", () => {
  beforeEach(() => {
    tauri.invoke.mockReset();
    tauri.isTauri.mockReset();
    tauri.isTauri.mockReturnValue(true);
  });

  it("preserves model order while exposing only token-free DTO fields", async () => {
    tauri.invoke.mockResolvedValue([
      { slug: "gpt-second", displayName: "Second", accessToken: "access-sentinel" },
      { slug: "gpt-first", displayName: "First", authorization: "bearer-sentinel" },
    ]);

    const models = await listChatGptModelsNative();

    expect(models).toEqual([
      { slug: "gpt-second", displayName: "Second" },
      { slug: "gpt-first", displayName: "First" },
    ]);
    expect(tauri.invoke).toHaveBeenCalledWith("chatgpt_list_models");
    expect(JSON.stringify(models)).not.toMatch(/token|authorization|sentinel/i);
  });

  it("rejects malformed model DTOs", () => {
    expect(() => parseChatGptModels([{ slug: "gpt", displayName: "" }])).toThrow();
    expect(() => parseChatGptModels({ models: [] })).toThrow();
  });

  it("invokes streaming text generation without frontend credentials or preview fields", async () => {
    tauri.invoke.mockResolvedValue("complete text");

    await expect(generateChatGptTextNative("gpt-account", "hello")).resolves.toBe("complete text");

    expect(tauri.invoke).toHaveBeenCalledWith("chatgpt_generate_text", {
      model: "gpt-account",
      prompt: "hello",
    });
    expect(JSON.stringify(tauri.invoke.mock.calls)).not.toMatch(/token|temperature|background|conversation|max_output_tokens|metadata|top_p/i);
  });

  it("normalizes admission, usage, rate, reauthentication, and temporary failures", () => {
    expect(normalizeChatGptPlanError("401").code).toBe("reauthenticationRequired");
    expect(normalizeChatGptPlanError("403 direct-route admission failure").code).toBe("accessDenied");
    expect(normalizeChatGptPlanError("subscription_sharing_usage_limit_exceeded").code).toBe("usageLimitExceeded");
    expect(normalizeChatGptPlanError({ code: "usageUnavailable" }).code).toBe("usageUnavailable");
    expect(normalizeChatGptPlanError({ code: "reauthenticationRequired" }).code).toBe("reauthenticationRequired");
    expect(normalizeChatGptPlanError({ code: "permissionDenied" }).code).toBe("accessDenied");
    expect(normalizeChatGptPlanError("429 rate_limit").code).toBe("rateLimited");
    expect(normalizeChatGptPlanError("503 raw access-sentinel").code).toBe("temporaryFailure");
    expect(normalizeChatGptPlanError("503 raw access-sentinel").message).not.toContain("access-sentinel");
  });
});
