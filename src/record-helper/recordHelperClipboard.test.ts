import { describe, expect, it, vi } from "vitest";
import { copyRecordHelperDraft } from "./recordHelperClipboard";

describe("record helper draft clipboard", () => {
  it("copies only the exact AI draft on success", async () => {
    const writeText = vi.fn(async () => undefined);

    const result = await copyRecordHelperDraft(writeText, "비식별 AI 초안");

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith("비식별 AI 초안");
    expect(result).toEqual({ status: "success", message: "AI 초안을 복사했습니다." });
  });

  it("returns an accessible failure message without changing the draft", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("clipboard unavailable");
    });
    const draft = "유지되어야 하는 AI 초안";

    const result = await copyRecordHelperDraft(writeText, draft);

    expect(writeText).toHaveBeenCalledWith(draft);
    expect(result).toEqual({ status: "error", message: "AI 초안을 복사하지 못했습니다." });
    expect(draft).toBe("유지되어야 하는 AI 초안");
  });
});
