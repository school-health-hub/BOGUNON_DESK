// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyPurchaseItem, withPurchaseIssues } from "../../purchase/purchaseDomain";
import { defaultPurchaseOutputColumns, type PurchaseItem } from "../../purchase/types";
import { PurchaseHelperPanel } from "./PurchaseHelperPanel";

function validItem(id: string, name = "합성 품목"): PurchaseItem {
  return withPurchaseIssues({ ...createEmptyPurchaseItem(id), name, quantity: 2, unitPrice: 1_000 });
}

function renderPanel(initialItems: readonly PurchaseItem[]) {
  const onClose = vi.fn();
  let latestItems = initialItems;
  function Harness() {
    const [items, setItems] = useState(initialItems);
    latestItems = items;
    return <>
      <button type="button" onClick={() => setItems([validItem("replacement", "교체 품목")])}>외부 교체</button>
      <PurchaseHelperPanel
        items={items}
        sources={[]}
        candidates={[]}
        columns={defaultPurchaseOutputColumns}
        templates={[]}
        draft={null}
        draftTemplates={[]}
        settlement={null}
        onAnalysis={() => undefined}
        onAddItem={() => undefined}
        onCandidatesChange={() => undefined}
        onChange={setItems}
        onClose={onClose}
        onColumnsChange={() => undefined}
        onNotice={() => undefined}
        onSourcesChange={() => undefined}
        onTemplatesChange={() => undefined}
        onDraftChange={() => undefined}
        onDraftTemplatesChange={() => undefined}
        onSettlementChange={() => undefined}
      />
    </>;
  }
  return { ...render(<Harness />), getItems: () => latestItems, onClose };
}

describe("PurchaseHelperPanel item editing", () => {
  afterEach(cleanup);

  it("restores the cell value on Escape without closing the panel", () => {
    const { getItems, onClose } = renderPanel([validItem("item")]);
    const input = screen.getByLabelText("1행 규격");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "편집 초안" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(input.getAttribute("value")).toBe("");
    expect(getItems()[0]?.specification).toBe("");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not recommit a cancelled draft when blur follows Escape", () => {
    const { getItems } = renderPanel([validItem("item")]);
    const input = screen.getByLabelText("1행 구매처");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "취소할 구매처" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);

    expect(getItems()[0]?.vendor).toBe("");
  });

  it("commits the current draft on Enter", () => {
    const { getItems } = renderPanel([validItem("item")]);
    const input = screen.getByLabelText("1행 비고");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "확정 비고" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(getItems()[0]?.note).toBe("확정 비고");
  });

  it.each([{ key: "Tab", shiftKey: false }, { key: "Tab", shiftKey: true }])(
    "commits on $key while preserving native focus movement (shift: $shiftKey)",
    ({ key, shiftKey }) => {
      const { getItems } = renderPanel([validItem("item")]);
      const input = screen.getByLabelText("1행 예산항목");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "보건실 운영" } });

      const nativeMovementPreserved = fireEvent.keyDown(input, { key, shiftKey });

      expect(nativeMovementPreserved).toBe(true);
      expect(getItems()[0]?.budgetItem).toBe("보건실 운영");
    },
  );

  it("lets the Korean IME handle Enter and Escape before committing", () => {
    const { getItems, onClose } = renderPanel([validItem("item")]);
    const input = screen.getByLabelText("1행 품명");
    fireEvent.focus(input);
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "한글 조합" } });

    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Escape", isComposing: true });

    expect(input.getAttribute("value")).toBe("한글 조합");
    expect(getItems()[0]?.name).toBe("합성 품목");
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(getItems()[0]?.name).toBe("한글 조합");
  });

  it("keeps an intermediate numeric string until commit and then uses existing validation", () => {
    const { getItems } = renderPanel([validItem("item")]);
    const input = screen.getByLabelText("1행 수량");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "-" } });

    expect(input.getAttribute("value")).toBe("-");
    expect(getItems()[0]?.quantity).toBe(2);

    fireEvent.keyDown(input, { key: "Enter" });
    expect(Number.isNaN(getItems()[0]?.quantity)).toBe(true);
    expect(screen.getByText(/수량 확인/u)).toBeTruthy();
  });

  it("keeps a committed value when the review filter changes", () => {
    renderPanel([validItem("valid"), createEmptyPurchaseItem("error")]);
    const input = screen.getByLabelText("1행 규격");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "대형/10개입" } });
    fireEvent.keyDown(input, { key: "Enter" });

    fireEvent.click(screen.getByRole("button", { name: "오류 1" }));
    fireEvent.click(screen.getByRole("button", { name: "전체 2" }));

    expect(screen.getByLabelText("1행 규격").getAttribute("value")).toBe("대형/10개입");
  });

  it("opens the full-name dialog and saves through its buttons", () => {
    const { getItems } = renderPanel([validItem("item", "아주 긴 합성 품목명")]);
    const trigger = screen.getByRole("button", { name: "1행 품목명 전체 보기 및 수정" });
    fireEvent.click(trigger);

    const textarea = screen.getByLabelText("1행 전체 품목명");
    expect(document.activeElement).toBe(textarea);
    fireEvent.change(textarea, { target: { value: "수정한 긴 품목명" } });
    fireEvent.click(screen.getByRole("button", { name: "품목명 저장" }));

    expect(getItems()[0]?.name).toBe("수정한 긴 품목명");
    expect(screen.queryByRole("dialog", { name: "품목명 전체 보기 및 수정" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps ordinary Enter as a newline and saves with Ctrl+Enter", () => {
    const { getItems } = renderPanel([validItem("item")]);
    fireEvent.click(screen.getByRole("button", { name: "1행 품목명 전체 보기 및 수정" }));
    const textarea = screen.getByLabelText("1행 전체 품목명");
    fireEvent.change(textarea, { target: { value: "첫 줄\n둘째 줄" } });

    expect(fireEvent.keyDown(textarea, { key: "Enter" })).toBe(true);
    expect(screen.getByRole("dialog", { name: "품목명 전체 보기 및 수정" })).toBeTruthy();
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

    expect(getItems()[0]?.name).toBe("첫 줄\n둘째 줄");
  });

  it("cancels the name dialog with Escape without closing the Purchase panel", () => {
    const { getItems, onClose } = renderPanel([validItem("item", "원본 이름")]);
    fireEvent.click(screen.getByRole("button", { name: "1행 품목명 전체 보기 및 수정" }));
    const textarea = screen.getByLabelText("1행 전체 품목명");
    fireEvent.change(textarea, { target: { value: "취소 이름" } });
    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(getItems()[0]?.name).toBe("원본 이름");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "품의 도우미" })).toBeTruthy();
  });

  it("traps dialog focus and returns it to the originating row", () => {
    renderPanel([validItem("item")]);
    const trigger = screen.getByRole("button", { name: "1행 품목명 전체 보기 및 수정" });
    fireEvent.click(trigger);
    const textarea = screen.getByLabelText("1행 전체 품목명");
    const cancel = screen.getByRole("button", { name: "품목명 편집 취소" });
    const save = screen.getByRole("button", { name: "품목명 저장" });

    save.focus();
    fireEvent.keyDown(save, { key: "Tab" });
    expect(document.activeElement).toBe(textarea);
    textarea.focus();
    fireEvent.keyDown(textarea, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(save);
    fireEvent.click(cancel);
    expect(document.activeElement).toBe(trigger);
  });

  it("ignores dialog save shortcuts during Korean IME composition", () => {
    const { getItems } = renderPanel([validItem("item", "원본 이름")]);
    fireEvent.click(screen.getByRole("button", { name: "1행 품목명 전체 보기 및 수정" }));
    const textarea = screen.getByLabelText("1행 전체 품목명");
    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, { target: { value: "조합 중 이름" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true, isComposing: true });

    expect(getItems()[0]?.name).toBe("원본 이름");
    expect(screen.getByRole("dialog", { name: "품목명 전체 보기 및 수정" })).toBeTruthy();
  });

  it("discards stale drafts when the edited item is replaced", () => {
    const { getItems } = renderPanel([validItem("original", "원본 품목")]);
    const input = screen.getByLabelText("1행 규격");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "오래된 초안" } });

    fireEvent.click(screen.getByRole("button", { name: "외부 교체" }));

    expect(getItems()).toHaveLength(1);
    expect(getItems()[0]?.id).toBe("replacement");
    expect(getItems()[0]?.specification).toBe("");
  });
});
