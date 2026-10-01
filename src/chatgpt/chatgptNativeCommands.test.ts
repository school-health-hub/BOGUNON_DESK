import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  disconnectChatGptNative,
  getChatGptConnectionStateNative,
  startChatGptSignInNative,
} from "./chatgptConnectionService";
import type { ChatGptNativeConnectionState } from "./types";

const tauri = vi.hoisted(() => ({
  invoke: vi.fn<(command: string) => Promise<ChatGptNativeConnectionState>>(),
  isTauri: vi.fn<() => boolean>(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauri.invoke,
  isTauri: tauri.isTauri,
}));

const disconnectedNativeState: ChatGptNativeConnectionState = {
  status: "disconnected",
  email: null,
  displayName: null,
  planUsageEnabled: false,
  clientRegistrationExists: true,
  showPlanUsageNotice: false,
  notice: null,
};

describe("ChatGPT native commands", () => {
  beforeEach(() => {
    tauri.invoke.mockReset();
    tauri.isTauri.mockReset();
    tauri.isTauri.mockReturnValue(true);
    tauri.invoke.mockResolvedValue(disconnectedNativeState);
  });

  it("uses only the three token-free ChatGPT Tauri commands", async () => {
    await getChatGptConnectionStateNative();
    await startChatGptSignInNative();
    await disconnectChatGptNative();

    expect(tauri.invoke.mock.calls.map(([command]) => command)).toEqual([
      "chatgpt_get_connection_state",
      "chatgpt_start_sign_in",
      "chatgpt_disconnect",
    ]);
    expect(JSON.stringify(tauri.invoke.mock.calls)).not.toMatch(/token|code|verifier|authorization/i);
  });

  it("returns a token-free disconnected state outside Tauri without invoking native storage", async () => {
    tauri.isTauri.mockReturnValue(false);

    await expect(getChatGptConnectionStateNative()).resolves.toMatchObject({
      status: "disconnected",
      clientRegistrationExists: false,
    });

    expect(tauri.invoke).not.toHaveBeenCalled();
  });
});
