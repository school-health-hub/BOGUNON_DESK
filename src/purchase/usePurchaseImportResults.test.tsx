// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { useCallback, useReducer } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyPurchaseItem, withPurchaseIssues } from "./purchaseDomain";
import { createPurchaseEditingState, purchaseItemEditingReducer } from "./purchaseItemEditing";
import { createPurchaseImportSession, invalidatePurchaseImportContext, runPurchaseImportRequest } from "./purchaseImportSession";
import { usePurchaseImportResults } from "./usePurchaseImportResults";
import type { PurchaseAnalysisResult, PurchaseItem, PurchaseMappingCandidate, PurchaseSourceSummary } from "./types";

const item = (id: string) => withPurchaseIssues({ ...createEmptyPurchaseItem(id), name: `합성 ${id}`, quantity: 1, unitPrice: 10 });
const candidate = (id: string): PurchaseMappingCandidate => ({ id, sourceName: `${id}.csv`, sheetName: "CSV", rows: [], headerOptions: [] });
const source = (id: string, status: "success" | "needsMapping"): PurchaseSourceSummary => ({ candidateId: id, sourceName: `${id}.csv`, status, rowCount: status === "success" ? 1 : 0, message: null });
afterEach(cleanup);

function useOwner() {
  const [editing, edit] = useReducer(purchaseItemEditingReducer, [item("C")], createPurchaseEditingState);
  const appendItems = useCallback((items: readonly PurchaseItem[]) => edit({ type: "append", items }), []);
  const imports = usePurchaseImportResults(appendItems);
  return { editing, edit, imports };
}

describe("Purchase parent import result integration", () => {
  it("accepts mapping A once without losing concurrent source B or manual item edit C", async () => {
    const session = createPurchaseImportSession();
    const owner = renderHook(useOwner);
    act(() => owner.result.current.imports.append({ items: [], sources: [source("A", "needsMapping")], candidates: [candidate("A")] }));
    let finish: (result: PurchaseAnalysisResult) => void = () => undefined;
    const mapped: PurchaseAnalysisResult = { items: [item("A-item")], sources: [source("A", "success")], candidates: [] };
    const onError = vi.fn();
    const pending = runPurchaseImportRequest({ session, context: { origin: "mapping", candidateId: "A", headerRow: 0, mappingRevision: 1 }, analyze: () => new Promise<PurchaseAnalysisResult>((resolve) => { finish = resolve; }), apply: owner.result.current.imports.append, onError });
    act(() => {
      owner.result.current.imports.append({ items: [], sources: [source("B", "needsMapping")], candidates: [candidate("B")] });
      owner.result.current.edit({ type: "patch", id: "C", patch: { name: "사용자 수정 C" } });
    });
    await act(async () => { finish(mapped); await pending; });
    expect(owner.result.current.imports.sources).toEqual([source("A", "success"), source("B", "needsMapping")]);
    expect(owner.result.current.imports.candidates.map((entry) => entry.id)).toEqual(["B"]);
    expect(owner.result.current.editing.items.map((entry) => entry.name)).toEqual(["사용자 수정 C", "합성 A-item"]);
    expect(owner.result.current.editing.items.filter((entry) => entry.id === "A-item")).toHaveLength(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("does not mutate any parent state or reopen after mapping session reset", async () => {
    const session = createPurchaseImportSession();
    const owner = renderHook(useOwner);
    let finish: (result: PurchaseAnalysisResult) => void = () => undefined;
    const reopen = vi.fn(); const onError = vi.fn();
    const pending = runPurchaseImportRequest({ session, context: { origin: "mapping", candidateId: "A", headerRow: 0, mappingRevision: 1 }, analyze: () => new Promise<PurchaseAnalysisResult>((resolve) => { finish = resolve; }), apply: owner.result.current.imports.append, onAccepted: reopen, onError });
    session.invalidate();
    await act(async () => { finish({ items: [item("stale")], sources: [source("A", "success")], candidates: [] }); await pending; });
    expect(owner.result.current.editing.items.map((entry) => entry.id)).toEqual(["C"]);
    expect(owner.result.current.imports.sources).toEqual([]);
    expect(owner.result.current.imports.candidates).toEqual([]);
    expect(reopen).not.toHaveBeenCalled(); expect(onError).not.toHaveBeenCalled();
  });

  it.each(["success", "failure"] as const)("ignores late mapping %s after account templates are applied", async (outcome) => {
    const session = createPurchaseImportSession();
    const owner = renderHook(useOwner);
    let finish: (result: PurchaseAnalysisResult) => void = () => undefined;
    let fail: (error: Error) => void = () => undefined;
    const saveTemplate = vi.fn(); const reopen = vi.fn(); const onError = vi.fn();
    const pending = runPurchaseImportRequest({ session, context: { origin: "mapping", candidateId: "A", headerRow: 0, mappingRevision: 1 }, analyze: () => new Promise<PurchaseAnalysisResult>((resolve, reject) => { finish = resolve; fail = reject; }), apply: (result) => { owner.result.current.imports.append(result); saveTemplate(); }, onAccepted: reopen, onError });
    const applySettings = vi.fn();
    invalidatePurchaseImportContext(session, applySettings);
    await act(async () => {
      if (outcome === "success") finish({ items: [item("stale")], sources: [source("A", "success")], candidates: [] });
      else fail(new Error("old account failure"));
      await pending;
    });
    expect(applySettings).toHaveBeenCalledOnce();
    expect(owner.result.current.editing.items.map((entry) => entry.id)).toEqual(["C"]);
    expect(owner.result.current.imports.sources).toEqual([]); expect(owner.result.current.imports.candidates).toEqual([]);
    expect(saveTemplate).not.toHaveBeenCalled(); expect(reopen).not.toHaveBeenCalled(); expect(onError).not.toHaveBeenCalled();
  });
});
