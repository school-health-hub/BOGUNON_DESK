import { describe, expect, it, vi } from "vitest";
import { loadSelectedChatGptModel, saveSelectedChatGptModel } from "./chatgptModelPreference";

const createStorage = (initial: string | null = null) => ({
  getItem: vi.fn(() => initial),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

describe("ChatGPT model device preference", () => {
  it("stores only the selected model slug in device-local settings", () => {
    const storage = createStorage();

    saveSelectedChatGptModel("gpt-account-model", storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      "bogunon-desk:chatgpt-selected-model",
      "gpt-account-model",
    );
    expect(JSON.stringify(storage.setItem.mock.calls)).not.toMatch(/token|credential|authorization/i);
  });

  it("loads a slug and removes an empty selection", () => {
    const storage = createStorage("gpt-account-model");
    expect(loadSelectedChatGptModel(storage)).toBe("gpt-account-model");

    saveSelectedChatGptModel(null, storage);
    expect(storage.removeItem).toHaveBeenCalledWith("bogunon-desk:chatgpt-selected-model");
  });
});
