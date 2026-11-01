// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useReducer } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyPurchaseItem, withPurchaseIssues } from "../../purchase/purchaseDomain";
import { createPurchaseEditingState, purchaseItemEditingReducer } from "../../purchase/purchaseItemEditing";
import { defaultPurchaseOutputColumns } from "../../purchase/types";
import { PurchaseHelperPanel } from "./PurchaseHelperPanel";
import { purchaseRepository } from "../../purchase/purchaseRepository";

function setup() {
  const initial = [
    withPurchaseIssues({ ...createEmptyPurchaseItem("a"), name: "표시 품목", quantity: 1, unitPrice: 10, importedAmount: 20, vendor: "이전 A" }),
    withPurchaseIssues({ ...createEmptyPurchaseItem("b"), name: "숨김 품목", quantity: 1, unitPrice: 10, vendor: "이전 B" }),
  ];
  let current = createPurchaseEditingState(initial);
  const onClose = vi.fn();
  function Harness() {
    const [editing, onEdit] = useReducer(purchaseItemEditingReducer, initial, createPurchaseEditingState);
    current = editing;
    return <><button onClick={() => onEdit({ type: "append", items: [createEmptyPurchaseItem("incoming")] })}>합성 가져오기</button><PurchaseHelperPanel
      editing={editing} onEdit={onEdit} onAddItem={() => onEdit({ type: "append", items: [createEmptyPurchaseItem("new")] })}
      sources={[]} candidates={[]} columns={defaultPurchaseOutputColumns} templates={[]} draft={null} draftTemplates={[]} settlement={null}
      onAnalysis={() => undefined} onCandidatesChange={() => undefined} onClose={onClose} onColumnsChange={() => undefined} onNotice={() => undefined}
      onSourcesChange={() => undefined} onTemplatesChange={() => undefined} onDraftChange={() => undefined} onDraftTemplatesChange={() => undefined} onSettlementChange={() => undefined}
    /></>;
  }
  return { ...render(<Harness />), getState: () => current, onClose };
}
const openReview = () => {
  fireEvent.click(screen.getByRole("button", { name: "선택 품목 일괄 편집" }));
  fireEvent.change(screen.getByLabelText("구매처 처리 방식"), { target: { value: "set" } });
  fireEvent.change(screen.getByLabelText("일괄 구매처"), { target: { value: "공통" } });
  fireEvent.click(screen.getByRole("button", { name: "적용 내용 확인" }));
};

describe("PurchaseHelperPanel bulk editing integration", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("disables bulk editing when no rows are selected", () => {
    setup();
    fireEvent.click(screen.getByLabelText("전체 품목 선택"));
    expect(screen.getByRole("button", { name: "선택 품목 일괄 편집" }).hasAttribute("disabled")).toBe(true);
  });
  it("includes hidden selected rows and preserves filter and selection through undo", () => {
    const { getState } = setup();
    fireEvent.click(screen.getByRole("button", { name: "불일치 1" }));
    openReview();
    expect(screen.getByText(/선택 2개 · 숨겨진 선택 1개 · 실제 변경 2개/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "2개 품목에 적용" }));
    expect(getState().items.map((item) => item.vendor)).toEqual(["공통", "공통"]);
    fireEvent.click(screen.getByLabelText("1행 선택"));
    fireEvent.click(screen.getByRole("button", { name: "마지막 일괄 적용 실행 취소" }));
    expect(getState().items.map((item) => [item.vendor, item.selected])).toEqual([["이전 A", false], ["이전 B", true]]);
    expect(screen.getByRole("button", { name: "불일치 1" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("retains prior undo after cancelling a new dialog and Escape keeps the panel open", () => {
    const { getState, onClose } = setup();
    openReview();
    fireEvent.click(screen.getByRole("button", { name: "2개 품목에 적용" }));
    const undo = getState().undo;
    fireEvent.click(screen.getByRole("button", { name: "선택 품목 일괄 편집" }));
    const dialog = screen.getByRole("dialog", { name: "선택 품목 일괄 편집" });
    fireEvent.keyDown(within(dialog).getByLabelText("구매처 처리 방식"), { key: "Escape" });
    expect(getState().undo).toBe(undo);
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "선택 품목 일괄 편집" }));
  });
  it("blocks an import that makes confirmation stale and retains all imported rows", () => {
    const { getState } = setup();
    openReview();
    fireEvent.click(screen.getByRole("button", { name: "합성 가져오기" }));
    expect(screen.getByRole("button", { name: "2개 품목에 적용" }).hasAttribute("disabled")).toBe(true);
    expect(getState().items.map((item) => item.id)).toEqual(["a", "b", "incoming"]);
  });
  it("keeps undo across a tab switch and returns focus after applying", () => {
    const { getState } = setup();
    openReview();
    fireEvent.click(screen.getByRole("button", { name: "2개 품목에 적용" }));
    const undo = getState().undo;
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "선택 품목 일괄 편집" }));
    fireEvent.click(screen.getByRole("tab", { name: "품의문 작성" }));
    fireEvent.click(screen.getByRole("tab", { name: "품목내역" }));
    expect(getState().undo).toBe(undo);
    expect(screen.getByRole("button", { name: "마지막 일괄 적용 실행 취소" })).toBeDefined();
  });
  it.each(["cancel", "failure"] as const)("preserves undo after import %s without a data change", async (outcome) => {
    const { getState } = setup();
    openReview();
    fireEvent.click(screen.getByRole("button", { name: "2개 품목에 적용" }));
    const undo = getState().undo;
    const picker = vi.spyOn(purchaseRepository, "pickAndAnalyze");
    if (outcome === "cancel") picker.mockResolvedValue({ generation: 0, started: false });
    else picker.mockRejectedValue(new Error("합성 가져오기 실패"));
    fireEvent.click(screen.getByRole("button", { name: "파일 가져오기" }));
    await waitFor(() => expect(picker).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "선택 품목 일괄 편집" }).hasAttribute("disabled")).toBe(false));
    expect(getState().undo).toBe(undo);
  });
});
