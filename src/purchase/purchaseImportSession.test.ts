import { describe, expect, it, vi } from "vitest";
import { createPurchaseImportSession, mergePurchaseImportCandidates, mergePurchaseImportSources, runPurchaseImportRequest } from "./purchaseImportSession";
import type { PurchaseAnalysisResult, PurchaseMappingCandidate, PurchaseSourceSummary } from "./types";

const source = (candidateId: string, status: "success" | "needsMapping"): PurchaseSourceSummary => ({ candidateId, sourceName: `${candidateId}.csv`, status, rowCount: status === "success" ? 1 : 0, message: null });
const candidate = (id: string): PurchaseMappingCandidate => ({ id, sourceName: `${id}.csv`, sheetName: "CSV", rows: [], headerOptions: [] });
const result: PurchaseAnalysisResult = { items: [], sources: [source("first", "success")], candidates: [] };

describe("purchase import session", () => {
  it("accepts the exact current request once with its mapping context", () => {
    const session = createPurchaseImportSession();
    const token = session.begin({ candidateId: "first", headerRow: 2, mappingRevision: 4 });
    expect(token).toMatchObject({ candidateId: "first", headerRow: 2, mappingRevision: 4 });
    expect(session.accept({ ...token })).toBe(false);
    expect(session.accept(token)).toBe(true);
    expect(session.accept(token)).toBe(false);
    expect(session.isCurrent(token)).toBe(true);
  });

  it("rejects superseded requests and closed or reset sessions", () => {
    const session = createPurchaseImportSession();
    const earlier = session.begin();
    const latest = session.begin();
    expect(session.accept(earlier)).toBe(false);
    session.invalidate();
    expect(session.isCurrent(latest)).toBe(false);
    expect(session.accept(latest)).toBe(false);
    expect(session.begin().session).toBeGreaterThan(latest.session);
  });

  it("cannot accept a token from a different owner session", () => {
    const first = createPurchaseImportSession();
    const second = createPurchaseImportSession();
    const foreign = first.begin();
    second.begin();
    expect(second.accept(foreign)).toBe(false);
  });

  it("does not let delayed native starts take over a direct request or mapping", () => {
    const session = createPurchaseImportSession();
    const direct = session.begin();
    expect(session.beginNative(10)).toBeNull();
    expect(session.isCurrent(direct)).toBe(true);
    session.advanceNativeFloor(11);
    expect(session.accept(direct)).toBe(true);
    expect(session.beginNative(10)).toBeNull();
    expect(session.beginNative(11)).toBeNull();
    const mapping = session.begin({ origin: "mapping", candidateId: "first", headerRow: 1, mappingRevision: 2 });
    expect(session.beginNative(12)).toBeNull();
    expect(session.isCurrent(mapping)).toBe(true);
    expect(session.accept(mapping)).toBe(true);
    expect(session.beginNative(12)).toBeNull();
  });

  it("binds a new native generation to the picker and rejects duplicate starts", () => {
    const session = createPurchaseImportSession();
    session.advanceNativeFloor(4);
    const picker = session.begin({ origin: "picker" });
    expect(session.beginNative(5)).toBe(picker);
    expect(session.beginNative(5)).toBeNull();
    expect(session.accept(picker)).toBe(true);
    const next = session.beginNative(6);
    expect(next?.origin).toBe("native");
    expect(next).not.toBe(picker);
  });

  it("retains the native barrier across reset and ignores lower floors", () => {
    const session = createPurchaseImportSession();
    session.advanceNativeFloor(20);
    session.advanceNativeFloor(2);
    session.invalidate();
    expect(session.beginNative(19)).toBeNull();
    expect(session.beginNative(21)?.origin).toBe("native");
  });

  it("discards a delayed success without appending or reopening the panel", async () => {
    const session = createPurchaseImportSession();
    let finish: (value: PurchaseAnalysisResult) => void = () => undefined;
    const apply = vi.fn(); const onAccepted = vi.fn(); const onError = vi.fn();
    const pending = runPurchaseImportRequest({ session, analyze: () => new Promise<PurchaseAnalysisResult>((resolve) => { finish = resolve; }), apply, onAccepted, onError });
    session.invalidate();
    finish(result);
    await pending;
    expect(apply).not.toHaveBeenCalled();
    expect(onAccepted).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("discards a superseded error and allows the new request to apply", async () => {
    const session = createPurchaseImportSession();
    let fail: (reason: Error) => void = () => undefined;
    const apply = vi.fn(); const onError = vi.fn();
    const earlier = runPurchaseImportRequest({ session, analyze: () => new Promise<PurchaseAnalysisResult>((_resolve, reject) => { fail = reject; }), apply, onError });
    await runPurchaseImportRequest({ session, analyze: async () => result, apply, onError });
    fail(new Error("obsolete failure"));
    await earlier;
    expect(apply).toHaveBeenCalledExactlyOnceWith(result);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports a current failure and retries without consuming candidate state", async () => {
    const session = createPurchaseImportSession();
    const apply = vi.fn(); const onError = vi.fn();
    const failure = new Error("retryable");
    await runPurchaseImportRequest({ session, analyze: async () => { throw failure; }, apply, onError });
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(apply).not.toHaveBeenCalled();
    await runPurchaseImportRequest({ session, analyze: async () => result, apply, onError });
    expect(apply).toHaveBeenCalledExactlyOnceWith(result);
  });

  it("does not apply a result after its template or workspace context changes", async () => {
    const session = createPurchaseImportSession();
    let valid = true;
    let finish: (value: PurchaseAnalysisResult) => void = () => undefined;
    const apply = vi.fn(); const onAccepted = vi.fn(); const onError = vi.fn();
    const pending = runPurchaseImportRequest({ session, isValid: () => valid, analyze: () => new Promise<PurchaseAnalysisResult>((resolve) => { finish = resolve; }), apply, onAccepted, onError });
    valid = false;
    finish(result);
    await pending;
    expect(apply).not.toHaveBeenCalled(); expect(onAccepted).not.toHaveBeenCalled(); expect(onError).not.toHaveBeenCalled();
  });
});

describe("purchase import result merging", () => {
  it("replaces only the mapped candidate source and preserves concurrent sources", () => {
    const pending = source("first", "needsMapping");
    const other = source("second", "needsMapping");
    expect(mergePurchaseImportSources([pending, other], result.sources)).toEqual([result.sources[0], other]);
  });

  it("removes only the successfully mapped candidate and appends fresh candidates", () => {
    const first = candidate("first"); const second = candidate("second"); const third = candidate("third");
    expect(mergePurchaseImportCandidates([first, second], { ...result, candidates: [third] })).toEqual([second, third]);
    expect(mergePurchaseImportCandidates([], { items: [], sources: [source("first", "needsMapping")], candidates: [first] })).toEqual([first]);
  });
});
