// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfficialDocumentAiConfirmation } from "./OfficialDocumentAiConfirmation";

describe("OfficialDocumentAiConfirmation", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const renderConfirmation = (): HTMLTextAreaElement => {
    render(
      <OfficialDocumentAiConfirmation
        confirmation={{ outboundText: "검토할 전송본", providerLabel: "ChatGPT 요금제 · GPT Test" }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    return screen.getByLabelText("AI 서비스로 전송될 내용");
  };

  it("keeps keyboard focus inside the dialog when validation disables submit", () => {
    const editor = renderConfirmation();
    fireEvent.change(editor, { target: { value: "" } });
    const dialog = screen.getByRole("dialog", { name: "AI 전송 내용 확인" });
    const cancelButton = screen.getByRole("button", { name: "취소" });
    const closeButton = screen.getByRole("button", { name: "AI 전송 취소" });
    cancelButton.focus();
    fireEvent.keyDown(cancelButton, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("explains empty outbound validation to assistive technology", () => {
    const editor = renderConfirmation();
    fireEvent.change(editor, { target: { value: "" } });
    const message = screen.getByRole("alert");
    expect(message.textContent).toContain("AI로 보낼 내용을 입력해 주세요.");
    expect(editor.getAttribute("aria-invalid")).toBe("true");
    expect(editor.getAttribute("aria-describedby")).toContain(message.id);
    expect(screen.getByRole("button", { name: "확인 후 전송" })).toHaveProperty("disabled", true);
  });
});
