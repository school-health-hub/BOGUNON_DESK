// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyPurchaseItem } from "../../purchase/purchaseDomain";
import { PurchaseBulkEditDialog } from "./PurchaseBulkEditDialog";

describe("PurchaseBulkEditDialog", () => {
  afterEach(cleanup);
  const setup = () => {
    const props = { items: [createEmptyPurchaseItem("a"), createEmptyPurchaseItem("b")], revision: 1, hiddenSelectedCount: 1, busy: false, onApply: vi.fn(), onCancel: vi.fn() };
    return { ...render(<PurchaseBulkEditDialog {...props} />), props };
  };
  it("starts in keep mode and requires review before applying hidden selections", () => {
    const { props } = setup();
    expect(screen.getByRole("button", { name: "적용 내용 확인" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("구매처 처리 방식"), { target: { value: "set" } });
    expect(screen.getByRole("alert").textContent).toContain("지정할 값을 입력");
    fireEvent.change(screen.getByLabelText("일괄 구매처"), { target: { value: "공통" } });
    fireEvent.click(screen.getByRole("button", { name: "적용 내용 확인" }));
    expect(screen.getByText(/선택 2개 · 숨겨진 선택 1개 · 실제 변경 2개/)).toBeDefined();
    expect(props.onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "2개 품목에 적용" }));
    fireEvent.click(screen.getByRole("button", { name: "2개 품목에 적용" }));
    expect(props.onApply).toHaveBeenCalledTimes(1);
    expect(props.onApply.mock.calls[0]?.[0].selectedIds).toEqual(["a", "b"]);
  });
  it("blocks stale review and allows reviewing current data again", () => {
    const { props, rerender } = setup();
    fireEvent.change(screen.getByLabelText("구매처 처리 방식"), { target: { value: "set" } });
    fireEvent.change(screen.getByLabelText("일괄 구매처"), { target: { value: "공통" } });
    fireEvent.click(screen.getByRole("button", { name: "적용 내용 확인" }));
    rerender(<PurchaseBulkEditDialog {...props} revision={2} />);
    expect(screen.getByRole("button", { name: "2개 품목에 적용" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("변경되었습니다");
    fireEvent.click(screen.getByRole("button", { name: "돌아가기" }));
    fireEvent.click(screen.getByRole("button", { name: "적용 내용 확인" }));
    fireEvent.click(screen.getByRole("button", { name: "2개 품목에 적용" }));
    expect(props.onApply.mock.calls[0]?.[0].revision).toBe(2);
  });
  it("blocks selection-only stale review and wraps focus around the disabled apply button", () => {
    const { props, rerender } = setup();
    fireEvent.change(screen.getByLabelText("구매처 처리 방식"), { target: { value: "set" } });
    fireEvent.change(screen.getByLabelText("일괄 구매처"), { target: { value: "공통" } });
    fireEvent.click(screen.getByRole("button", { name: "적용 내용 확인" }));
    rerender(<PurchaseBulkEditDialog {...props} items={props.items.map((item) => item.id === "b" ? { ...item, selected: false } : item)} />);
    expect(screen.getByRole("button", { name: "2개 품목에 적용" }).hasAttribute("disabled")).toBe(true);
    const close = screen.getByLabelText("일괄 편집 취소");
    const cancel = screen.getByRole("button", { name: "취소" });
    close.focus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cancel);
    expect(props.onApply).not.toHaveBeenCalled();
  });
  it("protects Korean composition and cancels only after composition ends", () => {
    const { props } = setup();
    fireEvent.change(screen.getByLabelText("구매처 처리 방식"), { target: { value: "set" } });
    const input = screen.getByLabelText("일괄 구매처");
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "한글 조합" } });
    fireEvent.keyDown(input, { key: "Escape", isComposing: true });
    expect(props.onCancel).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onApply).not.toHaveBeenCalled();
  });
  it("traps focus including the close button and clears only explicitly", () => {
    setup();
    const close = screen.getByLabelText("일괄 편집 취소");
    const cancel = screen.getByRole("button", { name: "취소" });
    close.focus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(cancel, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.change(screen.getByLabelText("구매처 처리 방식"), { target: { value: "clear" } });
    expect(screen.getByText("선택 품목의 기존 구매처 값을 제거합니다.")).toBeDefined();
  });
});
