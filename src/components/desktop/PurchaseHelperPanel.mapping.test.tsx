// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPurchaseEditingState } from "../../purchase/purchaseItemEditing";
import { purchaseRepository } from "../../purchase/purchaseRepository";
import { createPurchaseImportSession } from "../../purchase/purchaseImportSession";
import { defaultPurchaseOutputColumns, type PurchaseAnalysisResult, type PurchaseImportTemplate, type PurchaseMappingCandidate } from "../../purchase/types";
import { PurchaseHelperPanel } from "./PurchaseHelperPanel";

const native = vi.hoisted(() => ({ desktop: false, handlers: new Map<string, (event: { readonly payload: unknown }) => void>(), invoke: vi.fn() }));
vi.mock("../../desktop/actions", () => ({ isDesktopRuntime: () => native.desktop }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async (name: string, handler: (event: { readonly payload: unknown }) => void) => { native.handlers.set(name, handler); return () => { native.handlers.delete(name); }; } }));
const candidate: PurchaseMappingCandidate = {
  id: "candidate", sourceName: "합성.xlsx", sheetName: "견적",
  rows: [["품명", "수량", "수량"], ["합성 품목", "1", "2"]],
  headerOptions: [{ rowIndex: 0, headers: ["품명", "수량", "수량"], signature: ["품명", "수량", "수량"], recommended: true,
    recommendation: { mapping: { name: 0, quantity: 1 }, confidence: "review", warnings: [], fields: [
      { field: "name", columnIndex: 0, header: "품명", confidence: "automatic", reasons: ["품명 머리글이 일치합니다."], warnings: [] },
      { field: "quantity", columnIndex: 1, header: "수량", confidence: "review", reasons: ["수량 머리글이 여러 개입니다."], warnings: [] },
    ] } }],
};
const result: PurchaseAnalysisResult = { items: [], candidates: [], sources: [{ sourceName: "합성.xlsx", candidateId: "candidate", status: "success", rowCount: 1, message: null }] };
const setup = (inputCandidate = candidate, templates: readonly PurchaseImportTemplate[] = []) => {
  const props = {
    importSession: createPurchaseImportSession(), editing: createPurchaseEditingState(), sources: [{ sourceName: "합성.xlsx", status: "needsMapping" as const, rowCount: 0, message: "열 지정", candidateId: "candidate" }],
    columns: defaultPurchaseOutputColumns, candidates: [inputCandidate], templates, draft: null, draftTemplates: [], settlement: null,
    onAnalysis: vi.fn(), onAddItem: vi.fn(), onEdit: vi.fn(), onCandidatesChange: vi.fn(), onColumnsChange: vi.fn(), onSourcesChange: vi.fn(),
    onTemplatesChange: vi.fn(), onDraftChange: vi.fn(), onDraftTemplatesChange: vi.fn(), onSettlementChange: vi.fn(), onClose: vi.fn(), onNotice: vi.fn(),
  };
  const rendered = render(<PurchaseHelperPanel {...props} />);
  screen.getByRole("button", { name: "열 지정" }).focus();
  fireEvent.click(screen.getByRole("button", { name: "열 지정" }));
  return { ...rendered, props };
};
describe("PurchaseHelperPanel mapping review", () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); native.desktop = false; native.handlers.clear(); native.invoke.mockReset(); });
  it("keeps recommendation provisional and preserves manual indexed choices on reapply", async () => {
    const apply = vi.spyOn(purchaseRepository, "applyMapping").mockResolvedValue(result);
    const { props } = setup();
    expect(props.onAnalysis).not.toHaveBeenCalled();
    expect(screen.getByText("확인 권장")).toBeDefined();
    fireEvent.change(screen.getByLabelText("수량에 연결할 원본 열"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "추천 다시 적용" }));
    expect(screen.getByText("직접 수정")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await act(async () => { await Promise.resolve(); });
    expect(apply).toHaveBeenCalledWith(candidate, 0, { name: 0, quantity: 2 });
    expect(props.onAnalysis).toHaveBeenCalledWith(result);
    expect(props.onSourcesChange).not.toHaveBeenCalled();
    expect(props.onCandidatesChange).not.toHaveBeenCalled();
  });
  it("keeps draft after failure and permits retry", async () => {
    const apply = vi.spyOn(purchaseRepository, "applyMapping").mockRejectedValueOnce(new Error("failure")).mockResolvedValueOnce(result);
    const { props } = setup();
    fireEvent.change(screen.getByLabelText("수량에 연결할 원본 열"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByLabelText<HTMLSelectElement>("수량에 연결할 원본 열").value).toBe("2");
    expect(props.onAnalysis).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await act(async () => { await Promise.resolve(); });
    expect(apply).toHaveBeenCalledTimes(2);
    expect(props.onAnalysis).toHaveBeenCalledTimes(1);
  });
  it("ignores stale mapping failure and finally after a new request begins", async () => {
    let rejectMapping: (error: Error) => void = () => undefined;
    vi.spyOn(purchaseRepository, "applyMapping").mockImplementation(() => new Promise((_resolve, reject) => { rejectMapping = reject; }));
    const { props } = setup();
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await act(async () => { await Promise.resolve(); });
    props.importSession.begin();
    await act(async () => { rejectMapping(new Error("late")); });
    expect(props.onNotice).not.toHaveBeenCalled();
    expect(props.onAnalysis).not.toHaveBeenCalled();
    expect(props.onTemplatesChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "분석 중…" }).hasAttribute("disabled")).toBe(true);
  });
  it("ignores late success after closing mapping and does not save a remembered template", async () => {
    let resolveMapping: (value: PurchaseAnalysisResult) => void = () => undefined;
    vi.spyOn(purchaseRepository, "applyMapping").mockImplementation(() => new Promise((resolve) => { resolveMapping = resolve; }));
    const { props } = setup();
    fireEvent.click(screen.getByLabelText("이 열 구성을 기억하기"));
    fireEvent.change(screen.getByLabelText("가져오기 템플릿 이름"), { target: { value: "합성 설정" } });
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "열 지정 닫기" }));
    const nativeToken = props.importSession.beginNative(50);
    expect(nativeToken).not.toBeNull();
    await act(async () => { resolveMapping(result); });
    expect(props.onAnalysis).not.toHaveBeenCalled();
    expect(props.onTemplatesChange).not.toHaveBeenCalled();
    expect(props.onNotice).not.toHaveBeenCalled();
    if (nativeToken !== null) expect(props.importSession.isCurrent(nativeToken)).toBe(true);
  });
  it("blocks applying a manually cleared required field", () => {
    setup();
    fireEvent.change(screen.getByLabelText("품명에 연결할 원본 열"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "적용" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("품명");
  });
  it("starts a fresh recommendation draft after deliberately changing the header row", () => {
    const input = { ...candidate, headerOptions: [...candidate.headerOptions, { rowIndex: 1, headers: ["품목", "개수", "비고"], signature: ["품목", "개수", "비고"], recommended: false }] };
    setup(input);
    fireEvent.change(screen.getByLabelText("수량에 연결할 원본 열"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("머리글 행 선택"), { target: { value: "1" } });
    expect(screen.getByLabelText<HTMLSelectElement>("품명에 연결할 원본 열").value).toBe("");
    expect(screen.queryByText("직접 수정")).toBeNull();
    expect(screen.getByText("직접 지정 필요")).toBeDefined();
  });
  it("traps keyboard focus and restores the trigger on Escape", () => {
    setup();
    const close = screen.getByRole("button", { name: "열 지정 닫기" });
    const apply = screen.getByRole("button", { name: "적용" });
    close.focus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(apply);
    fireEvent.keyDown(apply, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "열 지정" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "열 지정" }));
  });
  it("ignores duplicate and older native starts after a newer mapping begins", async () => {
    native.desktop = true;
    native.invoke.mockResolvedValue(10);
    let resolveMapping: (value: PurchaseAnalysisResult) => void = () => undefined;
    vi.spyOn(purchaseRepository, "applyMapping").mockImplementation(() => new Promise((resolve) => { resolveMapping = resolve; }));
    const { props } = setup();
    await act(async () => { await Promise.resolve(); });
    act(() => { native.handlers.get("purchase:analysis-start")?.({ payload: 5 }); });
    act(() => { native.handlers.get("purchase:analysis")?.({ payload: { generation: 5, result: { items: [], sources: [], candidates: [] } } }); });
    props.onAnalysis.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await act(async () => { await Promise.resolve(); });
    act(() => {
      native.handlers.get("purchase:analysis-start")?.({ payload: 5 });
      native.handlers.get("purchase:analysis-start")?.({ payload: 4 });
    });
    await act(async () => { resolveMapping(result); });
    expect(props.onAnalysis).toHaveBeenCalledTimes(1);
    expect(props.onAnalysis).toHaveBeenCalledWith(result);
  });
  it("rejects never-seen old native starts after mapping has already been accepted", async () => {
    native.desktop = true;
    native.invoke.mockResolvedValue(10);
    vi.spyOn(purchaseRepository, "applyMapping").mockResolvedValue(result);
    const { props } = setup();
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await act(async () => { await Promise.resolve(); });
    expect(props.onAnalysis).toHaveBeenCalledTimes(1);
    props.onAnalysis.mockClear();
    act(() => {
      native.handlers.get("purchase:analysis-start")?.({ payload: 7 });
      native.handlers.get("purchase:analysis")?.({ payload: { generation: 7, result } });
    });
    expect(props.onAnalysis).not.toHaveBeenCalled();
    expect(props.onNotice).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "파일 가져오기" }).hasAttribute("disabled")).toBe(false);
  });
  it("ignores picker rejection after a newer direct request takes ownership", async () => {
    let rejectPicker: (reason: Error) => void = () => undefined;
    vi.spyOn(purchaseRepository, "pickAndAnalyze").mockImplementation(() => new Promise((_resolve, reject) => { rejectPicker = reject; }));
    const { props } = setup();
    fireEvent.click(screen.getByRole("button", { name: "열 지정 닫기" }));
    fireEvent.click(screen.getByRole("button", { name: "파일 가져오기" }));
    await act(async () => { await Promise.resolve(); });
    props.importSession.begin();
    await act(async () => { rejectPicker(new Error("old picker")); });
    expect(props.onNotice).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "파일 가져오기" }).hasAttribute("disabled")).toBe(true);
  });
  it("commits local view cleanup before an analysis callback invalidates later template effects", async () => {
    vi.spyOn(purchaseRepository, "applyMapping").mockResolvedValue(result);
    const { props } = setup();
    props.onAnalysis.mockImplementation(() => { props.importSession.invalidate(); });
    fireEvent.click(screen.getByLabelText("이 열 구성을 기억하기"));
    fireEvent.change(screen.getByLabelText("가져오기 템플릿 이름"), { target: { value: "합성 설정" } });
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await act(async () => { await Promise.resolve(); });
    expect(props.onAnalysis).toHaveBeenCalledTimes(1);
    expect(props.onTemplatesChange).not.toHaveBeenCalled();
    expect(props.onNotice).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "열 지정" })).toBeNull();
    expect(screen.getByRole("button", { name: "파일 가져오기" }).hasAttribute("disabled")).toBe(false);
  });
  it("commits local cleanup and stops save when replacement confirmation invalidates the session", async () => {
    vi.spyOn(purchaseRepository, "applyMapping").mockResolvedValue(result);
    const { props } = setup(candidate, [{ id: "old", name: "기존", headerSignature: ["품명", "수량", "수량"], mapping: { name: 0 } }]);
    vi.spyOn(window, "confirm").mockImplementation(() => { props.importSession.invalidate(); return true; });
    fireEvent.click(screen.getByLabelText("이 열 구성을 기억하기"));
    fireEvent.change(screen.getByLabelText("가져오기 템플릿 이름"), { target: { value: "합성 설정" } });
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await act(async () => { await Promise.resolve(); });
    expect(props.onTemplatesChange).not.toHaveBeenCalled();
    expect(props.onNotice).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "열 지정" })).toBeNull();
  });
  it("preserves draft and clears owned busy when template context changes during analysis", async () => {
    let rejectMapping: (error: Error) => void = () => undefined;
    vi.spyOn(purchaseRepository, "applyMapping").mockImplementation(() => new Promise((_resolve, reject) => { rejectMapping = reject; }));
    const { props, rerender } = setup();
    fireEvent.change(screen.getByLabelText("수량에 연결할 원본 열"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await act(async () => { await Promise.resolve(); });
    rerender(<PurchaseHelperPanel {...props} templates={[]} />);
    await act(async () => { rejectMapping(new Error("old context")); });
    expect(props.onNotice).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLSelectElement>("수량에 연결할 원본 열").value).toBe("2");
    expect(screen.getByRole("button", { name: "적용" }).hasAttribute("disabled")).toBe(false);
  });
  it("does not close a new mapping opened reentrantly by the accepted analysis callback", async () => {
    vi.spyOn(purchaseRepository, "applyMapping").mockResolvedValue(result);
    const { props } = setup();
    props.onAnalysis.mockImplementation(() => {
      props.importSession.invalidate();
      fireEvent.click(screen.getByRole("button", { name: "열 지정" }));
    });
    fireEvent.click(screen.getByLabelText("이 열 구성을 기억하기"));
    fireEvent.change(screen.getByLabelText("가져오기 템플릿 이름"), { target: { value: "이전 요청 설정" } });
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("dialog", { name: "열 지정" })).toBeDefined();
    expect(screen.getByRole("button", { name: "적용" }).hasAttribute("disabled")).toBe(false);
    expect(props.onTemplatesChange).not.toHaveBeenCalled();
    expect(props.onNotice).not.toHaveBeenCalled();
  });
  it("preserves draft and clears mapping busy on auth-only context changes with identical templates", async () => {
    let rejectMapping: (error: Error) => void = () => undefined;
    vi.spyOn(purchaseRepository, "applyMapping").mockImplementation(() => new Promise((_resolve, reject) => { rejectMapping = reject; }));
    const { props, rerender } = setup();
    fireEvent.change(screen.getByLabelText("수량에 연결할 원본 열"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await act(async () => { await Promise.resolve(); });
    rerender(<PurchaseHelperPanel {...props} importContextRevision={1} />);
    await act(async () => { rejectMapping(new Error("old auth context")); });
    expect(props.onNotice).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLSelectElement>("수량에 연결할 원본 열").value).toBe("2");
    expect(screen.getByRole("button", { name: "적용" }).hasAttribute("disabled")).toBe(false);
  });
});
