// @vitest-environment jsdom
import { useCallback, useEffect, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyPurchaseItem, withPurchaseIssues } from "../../purchase/purchaseDomain";
import { createPurchaseImportSession } from "../../purchase/purchaseImportSession";
import { purchaseRepository } from "../../purchase/purchaseRepository";
import { usePurchaseImportResults } from "../../purchase/usePurchaseImportResults";
import { usePurchaseItemEditing } from "../../purchase/usePurchaseItemEditing";
import { defaultPurchaseOutputColumns, type PurchaseImportTemplate, type PurchaseItem, type PurchaseMappingCandidate } from "../../purchase/types";
import { PurchaseHelperPanel } from "./PurchaseHelperPanel";

vi.mock("../../desktop/actions", () => ({ isDesktopRuntime: () => false }));
const candidate = (id: string): PurchaseMappingCandidate => ({
  id, sourceName: `${id}.xlsx`, sheetName: "합성", rows: [["품명", "수량"], ["합성 품목", "1"]],
  headerOptions: [{ rowIndex: 0, headers: ["품명", "수량"], signature: ["품명", "수량"], recommended: true,
    recommendation: { mapping: { name: 0, quantity: 1 }, confidence: "automatic", fields: [], warnings: [] } }],
});
const first = candidate("first");
const second = candidate("second");

describe("PurchaseHelperPanel accepted mapping commit", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("unlocks controls and permits another mapping when remembering invalidates the production session", async () => {
    const saved = vi.fn();
    const closed = vi.fn();
    const notice = vi.fn();
    vi.spyOn(purchaseRepository, "applyMapping").mockImplementation(async (input) => ({
      items: [withPurchaseIssues({ ...createEmptyPurchaseItem(input.id), name: "합성 품목", quantity: 1, unitPrice: 100 })],
      candidates: [], sources: [{ sourceName: input.sourceName, candidateId: input.id, status: "success" as const, rowCount: 1, message: null }],
    }));
    function Owner() {
      const [session] = useState(createPurchaseImportSession);
      const [editing, edit] = usePurchaseItemEditing(true);
      const appendItems = useCallback((items: readonly PurchaseItem[]) => edit({ type: "append", items }), [edit]);
      const imports = usePurchaseImportResults(appendItems);
      const [templates, setTemplates] = useState<readonly PurchaseImportTemplate[]>([]);
      useEffect(() => {
        imports.append({ items: [], candidates: [first, second], sources: [first, second].map((entry) => ({ sourceName: entry.sourceName, candidateId: entry.id, status: "needsMapping" as const, rowCount: 0, message: "열 연결 확인" })) });
      }, [imports.append]);
      return <PurchaseHelperPanel importSession={session} editing={editing} sources={imports.sources} candidates={imports.candidates} templates={templates} columns={defaultPurchaseOutputColumns} draft={null} draftTemplates={[]} settlement={null}
        onAnalysis={imports.append} onAddItem={() => undefined} onEdit={edit} onCandidatesChange={imports.setCandidates} onColumnsChange={() => undefined} onSourcesChange={imports.setSources}
        onTemplatesChange={(next) => { session.invalidate(); setTemplates(next); saved(next); }} onDraftChange={() => undefined} onDraftTemplatesChange={() => undefined} onSettlementChange={() => undefined} onClose={closed} onNotice={notice} />;
    }
    render(<Owner />);
    const [openFirst] = screen.getAllByRole("button", { name: "열 지정" });
    if (openFirst === undefined) throw new Error("First synthetic mapping action is missing");
    fireEvent.click(openFirst);
    fireEvent.click(screen.getByLabelText("이 열 구성을 기억하기"));
    fireEvent.change(screen.getByLabelText("가져오기 템플릿 이름"), { target: { value: "합성 설정" } });
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await act(async () => { await Promise.resolve(); });
    expect(saved).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "열 지정" })).toBeNull();
    for (const name of ["파일 가져오기", "선택 품목 일괄 편집", "출력 미리보기"]) expect(screen.getByRole("button", { name }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "열 지정" }));
    expect(screen.getByRole("dialog", { name: "열 지정" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await act(async () => { await Promise.resolve(); });
    expect(purchaseRepository.applyMapping).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "열 지정" })).toBeNull();
    expect(notice).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    await act(async () => { await Promise.resolve(); });
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
