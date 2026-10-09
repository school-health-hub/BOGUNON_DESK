// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyPurchaseItem, withPurchaseIssues } from "../../purchase/purchaseDomain";
import { purchaseRepository } from "../../purchase/purchaseRepository";
import { defaultPurchaseOutputColumns, type PurchaseItem } from "../../purchase/types";
import { PurchaseHelperPanel } from "./PurchaseHelperPanel";

const renderPanel = (initialItems: readonly PurchaseItem[]) => {
  const onSettlementChange = vi.fn();
  function Harness() {
    const [items, setItems] = useState(initialItems);
    return (
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
        onClose={() => undefined}
        onColumnsChange={() => undefined}
        onNotice={vi.fn()}
        onSourcesChange={() => undefined}
        onTemplatesChange={() => undefined}
        onDraftChange={() => undefined}
        onDraftTemplatesChange={() => undefined}
        onSettlementChange={onSettlementChange}
      />
    );
  }
  return { ...render(<Harness />), onSettlementChange };
};

describe("PurchaseHelperPanel output readiness", () => {
  afterEach(cleanup);

  it("blocks downstream actions while a selected row has invalid input", () => {
    const { onSettlementChange } = renderPanel([createEmptyPurchaseItem("invalid")]);

    expect(screen.getByRole("status").textContent).toContain("입력 오류 1건");
    expect(screen.getByRole("button", { name: "표 복사" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "CSV 저장" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "XLSX 저장" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "에듀파인용 Excel" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("tab", { name: "품의문 작성" }));
    expect(screen.getByRole("button", { name: "품의문 초안 만들기" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("tab", { name: "구매결과" }));
    expect(onSettlementChange).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "품목내역" }).getAttribute("aria-selected")).toBe("true");
  });

  it("shows original and calculated amounts, enables output after review, and resets review after amount changes", () => {
    const mismatch = withPurchaseIssues({
      ...createEmptyPurchaseItem("mismatch"),
      name: "합성 마스크",
      quantity: 2,
      unitPrice: 1_000,
      importedAmount: 2_500,
    });
    renderPanel([mismatch]);

    expect(screen.getByText("원본 2,500원 · 계산 2,000원")).toBeTruthy();
    expect(screen.getByRole("button", { name: "1행 금액 불일치 확인" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "표 복사" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "에듀파인용 Excel" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "1행 금액 불일치 확인" }));
    expect(screen.getByText("금액 확인됨")).toBeTruthy();
    expect(screen.getByRole("button", { name: "표 복사" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "에듀파인용 Excel" }).hasAttribute("disabled")).toBe(false);

    fireEvent.change(screen.getByLabelText("1행 수량"), { target: { value: "3" } });
    expect(screen.getByText("원본 2,500원 · 계산 3,000원")).toBeTruthy();
    expect(screen.getByRole("button", { name: "표 복사" }).hasAttribute("disabled")).toBe(true);
  });

  it("exports safe selected items through the Edufine action", async () => {
    const safe = withPurchaseIssues({ ...createEmptyPurchaseItem("safe"), name: "합성 품목", quantity: 2, unitPrice: 1_000 });
    const exportEdufine = vi.spyOn(purchaseRepository, "exportEdufine").mockResolvedValue(true);
    renderPanel([safe]);

    fireEvent.click(screen.getByRole("button", { name: "에듀파인용 Excel" }));

    await waitFor(() => expect(exportEdufine).toHaveBeenCalledWith([safe]));
    exportEdufine.mockRestore();
  });
});
