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

    expect(screen.getByText("원본 2,500원 · 계산 2,000원 · 차이 -500원")).toBeTruthy();
    expect(screen.getByRole("button", { name: "1행 금액 불일치 확인" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "표 복사" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "에듀파인용 Excel" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "1행 금액 불일치 확인" }));
    expect(screen.getByText("금액 확인됨")).toBeTruthy();
    expect(screen.getByRole("button", { name: "표 복사" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "에듀파인용 Excel" }).hasAttribute("disabled")).toBe(false);

    fireEvent.change(screen.getByLabelText("1행 수량"), { target: { value: "3" } });
    expect(screen.getByText("원본 2,500원 · 계산 3,000원 · 차이 +500원")).toBeTruthy();
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

  it("filters rows by input errors, all mismatches, and unresolved review state", () => {
    const error = createEmptyPurchaseItem("error");
    const mismatch = withPurchaseIssues({
      ...createEmptyPurchaseItem("mismatch"),
      name: "미확인 불일치",
      quantity: 1,
      unitPrice: 1_000,
      importedAmount: 1_500,
    });
    const reviewedMismatch = withPurchaseIssues({
      ...createEmptyPurchaseItem("reviewed"),
      name: "확인 완료 불일치",
      quantity: 1,
      unitPrice: 2_000,
      importedAmount: 2_500,
      amountMismatchReviewed: true,
    });
    const valid = withPurchaseIssues({ ...createEmptyPurchaseItem("valid"), name: "정상 품목", quantity: 1, unitPrice: 3_000 });
    renderPanel([error, mismatch, reviewedMismatch, valid]);

    expect(screen.getByRole("button", { name: "전체 4" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "오류 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "불일치 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "확인 필요 2" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "불일치 2" }));
    expect(screen.getByLabelText("2행 품명")).toBeTruthy();
    expect(screen.getByLabelText("3행 품명")).toBeTruthy();
    expect(screen.queryByLabelText("1행 품명")).toBeNull();
    expect(screen.queryByLabelText("4행 품명")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "확인 필요 2" }));
    expect(screen.getByLabelText("1행 품명")).toBeTruthy();
    expect(screen.getByLabelText("2행 품명")).toBeTruthy();
    expect(screen.queryByLabelText("3행 품명")).toBeNull();
  });

  it("keeps selection, values, and export payload in original order while rows are filtered", async () => {
    const first = withPurchaseIssues({ ...createEmptyPurchaseItem("first"), name: "첫 품목", quantity: 1, unitPrice: 1_000 });
    const error = withPurchaseIssues({ ...createEmptyPurchaseItem("error"), selected: false, name: "오류 품목", quantity: 0, unitPrice: 500 });
    const second = withPurchaseIssues({ ...createEmptyPurchaseItem("second"), name: "둘째 품목", quantity: 1, unitPrice: 2_000 });
    const exportRows = vi.spyOn(purchaseRepository, "export").mockResolvedValue(true);
    renderPanel([first, error, second]);

    fireEvent.change(screen.getByLabelText("1행 품명"), { target: { value: "수정한 첫 품목" } });
    fireEvent.click(screen.getByRole("button", { name: "오류 1" }));

    expect(screen.getByText("3개 중 2개 선택")).toBeTruthy();
    expect(screen.getByText("현재 화면에 표시되지 않은 선택 품목 2개 포함")).toBeTruthy();
    expect(screen.getByText("출력과 일괄 적용은 선택된 전체 품목을 대상으로 합니다.")).toBeTruthy();
    expect(screen.getByLabelText("전체 품목 선택")).toHaveProperty("checked", false);

    fireEvent.click(screen.getByRole("button", { name: "CSV 저장" }));
    await waitFor(() => expect(exportRows).toHaveBeenCalledTimes(1));
    expect(exportRows.mock.calls[0]?.[1].map((item) => item.name)).toEqual(["수정한 첫 품목", "오류 품목", "둘째 품목"]);

    fireEvent.click(screen.getByRole("button", { name: "전체 3" }));
    expect(screen.getByLabelText("1행 품명").getAttribute("value")).toBe("수정한 첫 품목");
    expect(screen.getByLabelText("1행 선택")).toHaveProperty("checked", true);
    expect(screen.getByLabelText("2행 선택")).toHaveProperty("checked", false);
    exportRows.mockRestore();
  });

  it("keeps whole-list selection semantics and disables row movement outside the all filter", () => {
    const first = createEmptyPurchaseItem("first");
    const second = withPurchaseIssues({ ...createEmptyPurchaseItem("second"), name: "정상 품목", quantity: 1, unitPrice: 1_000 });
    renderPanel([first, second]);

    fireEvent.click(screen.getByRole("button", { name: "오류 1" }));
    expect(screen.getByRole("button", { name: "1행 위로 이동" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "1행 아래로 이동" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByLabelText("전체 품목 선택"));
    fireEvent.click(screen.getByRole("button", { name: "전체 2" }));
    expect(screen.getByLabelText("1행 선택")).toHaveProperty("checked", false);
    expect(screen.getByLabelText("2행 선택")).toHaveProperty("checked", false);
  });

  it("opens the needs-review filter from the existing problem-row action", () => {
    renderPanel([createEmptyPurchaseItem("invalid")]);

    fireEvent.click(screen.getByRole("button", { name: "문제 행 확인" }));

    expect(screen.getByRole("button", { name: "확인 필요 1" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("1행 품명")).toBeTruthy();
  });
});
