import { ArrowDown, ArrowUp, ClipboardCopy, FilePlus2, FileSpreadsheet, Plus, RotateCcw, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isDesktopRuntime } from "../../desktop/actions";
import { createPurchaseClipboard } from "../../purchase/purchaseClipboard";
import { createEmptyPurchaseItem, normalizePurchaseOutputColumns, selectedPurchaseTotal, withPurchaseIssues } from "../../purchase/purchaseDomain";
import { purchaseRepository } from "../../purchase/purchaseRepository";
import { createPurchaseDraft } from "../../purchase/purchaseDraft";
import { createPurchaseSettlement, reconcilePurchaseSettlement } from "../../purchase/purchaseSettlement";
import { purchaseImportFieldIds, purchaseImportFieldLabels, purchaseOutputColumnIds, purchaseOutputColumnLabels, type PurchaseAnalysisResult, type PurchaseColumnMapping, type PurchaseDraft, type PurchaseDraftTemplate, type PurchaseImportTemplate, type PurchaseItem, type PurchaseMappingCandidate, type PurchaseOutputColumnId, type PurchaseSettlement, type PurchaseSourceSummary } from "../../purchase/types";
import { PurchaseDraftEditor } from "./PurchaseDraftEditor";
import {
  createPurchaseHelperStateQueue,
  mountPurchaseHelperNativeBridge,
  type PurchaseHelperNativeBridge,
} from "./purchaseHelperNativeLifecycle";
import { PurchaseSettlementEditor } from "./PurchaseSettlementEditor";

type Props = {
  readonly items: readonly PurchaseItem[];
  readonly sources: readonly PurchaseSourceSummary[];
  readonly columns: readonly PurchaseOutputColumnId[];
  readonly candidates: readonly PurchaseMappingCandidate[];
  readonly templates: readonly PurchaseImportTemplate[];
  readonly draft: PurchaseDraft | null;
  readonly draftTemplates: readonly PurchaseDraftTemplate[];
  readonly settlement: PurchaseSettlement | null;
  readonly onAnalysis: (result: PurchaseAnalysisResult) => void;
  readonly onChange: (items: readonly PurchaseItem[]) => void;
  readonly onCandidatesChange: (candidates: readonly PurchaseMappingCandidate[]) => void;
  readonly onColumnsChange: (columns: readonly PurchaseOutputColumnId[]) => void;
  readonly onSourcesChange: (sources: readonly PurchaseSourceSummary[]) => void;
  readonly onTemplatesChange: (templates: readonly PurchaseImportTemplate[]) => void;
  readonly onDraftChange: (draft: PurchaseDraft | null) => void;
  readonly onDraftTemplatesChange: (templates: readonly PurchaseDraftTemplate[]) => void;
  readonly onSettlementChange: (settlement: PurchaseSettlement | null) => void;
  readonly onClose: () => void;
  readonly onNotice: (message: string) => void;
};

const numberValue = (value: string): number | null => value.trim() === "" ? null : Number(value.replace(/,/g, ""));
const issueLabels: Readonly<Record<string, string>> = { missingName: "품명 필요", invalidQuantity: "수량 확인", invalidUnitPrice: "단가 확인", amountMismatch: "금액 불일치" };
const purchaseHelperStateQueue = createPurchaseHelperStateQueue((active, templates) =>
  invoke("set_purchase_helper_active", { active, templates }),
);

export function PurchaseHelperPanel({ items, sources, columns, candidates, templates, draft, draftTemplates, settlement, onAnalysis, onChange, onCandidatesChange, onColumnsChange, onSourcesChange, onTemplatesChange, onDraftChange, onDraftTemplatesChange, onSettlementChange, onClose, onNotice }: Props) {
  const [activeView, setActiveView] = useState<"items" | "draft" | "settlement">("items");
  const [busy, setBusy] = useState(false);
  const [isColumnEditorOpen, setIsColumnEditorOpen] = useState(false);
  const [columnDraft, setColumnDraft] = useState<readonly PurchaseOutputColumnId[]>(columns);
  const [mappingCandidateId, setMappingCandidateId] = useState<string | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<PurchaseColumnMapping>({});
  const [rememberTemplate, setRememberTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const onAnalysisRef = useRef(onAnalysis);
  const onNoticeRef = useRef(onNotice);
  const nativeBridgeRef = useRef<PurchaseHelperNativeBridge | null>(null);
  const mappingCandidate = candidates.find((candidate) => candidate.id === mappingCandidateId) ?? null;
  const headerOption = mappingCandidate?.headerOptions.find((option) => option.rowIndex === headerRow) ?? null;
  const total = useMemo(() => selectedPurchaseTotal(items), [items]);
  const selectedCount = items.filter((item) => item.selected).length;
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { if (mappingCandidateId !== null) setMappingCandidateId(null); else onClose(); } };
    window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close);
  }, [mappingCandidateId, onClose]);
  useLayoutEffect(() => {
    onAnalysisRef.current = onAnalysis;
    onNoticeRef.current = onNotice;
  }, [onAnalysis, onNotice]);
  useEffect(() => {
    if (!isDesktopRuntime()) return undefined;
    const bridge = mountPurchaseHelperNativeBridge({
      registrars: {
        analysis: (handler) =>
          listen<PurchaseAnalysisResult>("purchase:analysis", (event) => handler(event.payload)),
        error: (handler) =>
          listen<string>("purchase:analysis-error", (event) => handler(event.payload)),
      },
      callbacks: {
        analysis: () => onAnalysisRef.current,
        notice: () => onNoticeRef.current,
      },
      stateQueue: purchaseHelperStateQueue,
      initialTemplates: templates,
    });
    nativeBridgeRef.current = bridge;
    return () => {
      if (nativeBridgeRef.current === bridge) nativeBridgeRef.current = null;
      bridge.dispose();
    };
  }, []);
  useLayoutEffect(() => {
    nativeBridgeRef.current?.syncTemplates(templates);
  }, [templates]);
  useEffect(() => {
    if (settlement === null) return;
    const reconciled = reconcilePurchaseSettlement(settlement, items);
    if (reconciled !== settlement) onSettlementChange(reconciled);
  }, [items, onSettlementChange, settlement]);

  const update = (id: string, patch: Partial<Omit<PurchaseItem, "id" | "issues">>) => onChange(items.map((item) => item.id === id ? withPurchaseIssues({ ...item, ...patch }) : item));
  const importFiles = async () => {
    setBusy(true);
    try {
      const result = await purchaseRepository.pickAndAnalyze(templates);
      if (result !== null) onAnalysis(result);
    } catch { onNotice("파일을 분석하지 못했습니다."); } finally { setBusy(false); }
  };
  const copy = async () => {
    try {
      const content = createPurchaseClipboard(items, columns);
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write !== undefined) await navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([content.text], { type: "text/plain" }), "text/html": new Blob([content.html], { type: "text/html" }) })]);
      else await navigator.clipboard.writeText(content.text);
      onNotice("품목내역을 복사했습니다.");
    } catch { onNotice("품목내역을 복사하지 못했습니다."); }
  };
  const exportRows = async (format: "xlsx" | "csv") => {
    setBusy(true); try { if (await purchaseRepository.export(format, items, columns)) onNotice(`${format.toUpperCase()} 파일로 저장했습니다.`); } catch { onNotice("파일을 저장하지 못했습니다."); } finally { setBusy(false); }
  };
  const startNew = () => {
    if (items.length === 0 || window.confirm("현재 품목내역과 품의문 초안, 구매결과를 비우고 새 작업을 시작할까요?")) { onChange([]); onSourcesChange([]); onCandidatesChange([]); onDraftChange(null); onSettlementChange(null); setActiveView("items"); }
  };
  const openMapping = (candidateId: string) => {
    const candidate = candidates.find((entry) => entry.id === candidateId); if (candidate === undefined) return;
    const option = candidate.headerOptions.find((entry) => entry.recommended) ?? candidate.headerOptions[0];
    setMappingCandidateId(candidateId); setHeaderRow(option?.rowIndex ?? 0); setMapping({}); setRememberTemplate(false); setTemplateName("");
  };
  const applyMapping = async () => {
    if (mappingCandidate === null || headerOption === null || mapping.name === undefined) { onNotice("품명에 연결할 원본 열을 선택해 주세요."); return; }
    setBusy(true);
    try {
      const result = await purchaseRepository.applyMapping(mappingCandidate, headerRow, mapping);
      onChange([...items, ...result.items]);
      onSourcesChange(sources.map((source) => source.candidateId === mappingCandidate.id ? result.sources[0] : source));
      onCandidatesChange(candidates.filter((candidate) => candidate.id !== mappingCandidate.id));
      if (rememberTemplate) {
        const name = templateName.trim();
        if (name.length === 0 || name.length > 40) onNotice("템플릿 이름은 1~40자로 입력해 주세요.");
        else {
          const existing = templates.find((template) => JSON.stringify(template.headerSignature) === JSON.stringify(headerOption.signature));
          const maySave = existing === undefined || window.confirm("같은 형식의 저장된 열 설정이 있습니다. 현재 설정으로 바꿀까요?");
          if (maySave) {
            if (existing === undefined && templates.length >= 20) onNotice("가져오기 템플릿은 최대 20개까지 저장할 수 있습니다.");
            else onTemplatesChange(existing === undefined ? [...templates, { id: `import-template-${Date.now()}`, name, headerSignature: headerOption.signature, mapping }] : templates.map((template) => template.id === existing.id ? { ...template, name, mapping } : template));
          }
        }
      }
      setMappingCandidateId(null);
    } catch { onNotice("열 설정으로 품목을 분석하지 못했습니다."); } finally { setBusy(false); }
  };
  const moveColumn = (column: PurchaseOutputColumnId, delta: number) => {
    const next = [...columnDraft]; const index = next.indexOf(column); const target = index + delta;
    if (index < 0 || target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; setColumnDraft(next);
  };
  return (
    <div className="desktop-panel-backdrop purchase-helper-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="purchase-helper-panel" role="dialog" aria-modal="true" aria-labelledby="purchase-helper-title">
        <header className="purchase-helper-panel__header"><span><FileSpreadsheet size={20} /></span><div><h2 id="purchase-helper-title">품의 도우미</h2><p>품목 정리부터 품의문 작성, 실제 구매금액 정산까지 이어갑니다.</p></div><button type="button" aria-label="품의 도우미 닫기" onClick={onClose}><X size={18} /></button></header>
        <div className="purchase-helper-panel__toolbar">
          <button type="button" onClick={() => void importFiles()} disabled={busy}><FilePlus2 size={16} /> 파일 가져오기</button>
          <button type="button" onClick={() => onChange([...items, createEmptyPurchaseItem(`manual-${Date.now()}`)])}><Plus size={16} /> 품목 추가</button>
          <button type="button" onClick={startNew}><RotateCcw size={16} /> 새 작업</button>
          <button type="button" onClick={() => { setActiveView("items"); setShowTemplates((current) => !current); }}><Settings2 size={16} /> 가져오기 설정</button>
          <span>{selectedCount}개 선택 · {total.toLocaleString("ko-KR")}원</span>
        </div>
        <div className="purchase-helper-tabs" role="tablist" aria-label="품의 도우미 단계"><button type="button" role="tab" aria-selected={activeView === "items"} onClick={() => setActiveView("items")}>품목내역</button><button type="button" role="tab" aria-selected={activeView === "draft"} onClick={() => setActiveView("draft")}>품의문 작성</button><button type="button" role="tab" aria-selected={activeView === "settlement"} onClick={() => { if (settlement === null) onSettlementChange(createPurchaseSettlement(items)); setActiveView("settlement"); }}>구매결과</button></div>
        {activeView === "items" ? <>
        {showTemplates && <section className="purchase-import-templates"><strong>저장된 열 설정</strong>{templates.length === 0 ? <p>저장된 설정이 없습니다.</p> : templates.map((template) => <div key={template.id}><span><b>{template.name}</b><small>{Object.keys(template.mapping).length}개 열 연결</small></span><button type="button" onClick={() => { if (window.confirm(`'${template.name}' 열 설정을 삭제할까요?`)) onTemplatesChange(templates.filter((entry) => entry.id !== template.id)); }}>삭제</button></div>)}</section>}
        {sources.length > 0 && <div className="purchase-helper-sources" aria-label="가져온 파일"><strong>가져오기 결과</strong>{sources.map((source, index) => <span key={`${source.sourceName}-${index}`} className={`is-${source.status}`}>{source.sourceName} · {source.status === "success" ? `${source.rowCount}개` : source.message}{source.status === "needsMapping" && source.candidateId !== undefined && <button type="button" onClick={() => { if (source.candidateId !== undefined) openMapping(source.candidateId); }}>열 지정</button>}</span>)}</div>}
        <button className={`purchase-helper-dropzone${items.length > 0 ? " is-compact" : ""}`} type="button" onClick={() => void importFiles()} disabled={busy}><FilePlus2 size={items.length > 0 ? 16 : 22} /><strong>파일을 여기에 놓거나 선택하세요.</strong><span>XLSX · XLS · CSV · 텍스트형 PDF 자동 분석</span><small>스캔 PDF · PNG · JPG OCR은 아직 지원하지 않습니다.</small></button>
        <div className="purchase-helper-table-wrap">
          <table className="purchase-helper-table"><thead><tr><th><input type="checkbox" aria-label="전체 선택" checked={items.length > 0 && selectedCount === items.length} onChange={(event) => onChange(items.map((item) => ({ ...item, selected: event.target.checked })))} /></th><th>품명</th><th>규격</th><th>수량</th><th>단가</th><th>금액</th><th>구매처</th><th>비고</th><th>예산항목</th><th aria-label="행 작업" /></tr></thead>
            <tbody>{items.length === 0 ? <tr><td colSpan={10} className="purchase-helper-empty">파일을 가져오거나 품목을 직접 추가하세요.</td></tr> : items.map((item, index) => <tr key={item.id} className={item.issues.length > 0 ? "has-issue" : ""}>
              <td><input type="checkbox" aria-label={`${index + 1}행 선택`} checked={item.selected} onChange={(event) => update(item.id, { selected: event.target.checked })} /></td>
              <td><input aria-label={`${index + 1}행 품명`} value={item.name} onChange={(event) => update(item.id, { name: event.target.value })} />{item.issues.length > 0 && <small title={item.issues.map((issue) => issueLabels[issue]).join(", ")}>{item.issues.map((issue) => issueLabels[issue]).join(" · ")}</small>}</td>
              <td><input aria-label={`${index + 1}행 규격`} value={item.specification} onChange={(event) => update(item.id, { specification: event.target.value })} /></td>
              <td><input aria-label={`${index + 1}행 수량`} inputMode="decimal" value={item.quantity ?? ""} onChange={(event) => update(item.id, { quantity: numberValue(event.target.value) })} /></td>
              <td><input aria-label={`${index + 1}행 단가`} inputMode="decimal" value={item.unitPrice ?? ""} onChange={(event) => update(item.id, { unitPrice: numberValue(event.target.value) })} /></td>
              <td className="purchase-helper-amount">{(item.quantity !== null && item.unitPrice !== null ? Math.round(item.quantity * item.unitPrice) : item.importedAmount)?.toLocaleString("ko-KR") ?? "-"}</td>
              <td><input aria-label={`${index + 1}행 구매처`} value={item.vendor} onChange={(event) => update(item.id, { vendor: event.target.value })} /></td>
              <td><input aria-label={`${index + 1}행 비고`} value={item.note} onChange={(event) => update(item.id, { note: event.target.value })} /></td>
              <td><input aria-label={`${index + 1}행 예산항목`} value={item.budgetItem} onChange={(event) => update(item.id, { budgetItem: event.target.value })} /></td>
              <td><div className="purchase-helper-row-actions"><button type="button" aria-label={`${index + 1}행 위로 이동`} disabled={index === 0} onClick={() => { const next=[...items]; [next[index-1],next[index]]=[next[index],next[index-1]]; onChange(next); }}><ArrowUp size={13}/></button><button type="button" aria-label={`${index + 1}행 아래로 이동`} disabled={index === items.length - 1} onClick={() => { const next=[...items]; [next[index+1],next[index]]=[next[index],next[index+1]]; onChange(next); }}><ArrowDown size={13}/></button><button type="button" aria-label={`${index + 1}행 삭제`} onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}><Trash2 size={13}/></button></div></td>
            </tr>)}</tbody></table>
        </div>
        <section className="purchase-helper-columns"><button type="button" onClick={() => { setColumnDraft(columns); setIsColumnEditorOpen((current) => !current); }}>출력 컬럼 설정</button>{isColumnEditorOpen && <div className="purchase-helper-column-editor"><strong>출력 열</strong>{purchaseOutputColumnIds.map((column) => { const shown = columnDraft.includes(column); return <div className="purchase-helper-column" key={column}><label><input type="checkbox" checked={shown} disabled={column === "name"} onChange={(event) => setColumnDraft(normalizePurchaseOutputColumns(event.target.checked ? [...columnDraft, column] : columnDraft.filter((value) => value !== column)))} />{purchaseOutputColumnLabels[column]}</label>{shown && <span><button type="button" aria-label={`${purchaseOutputColumnLabels[column]} 왼쪽 이동`} onClick={() => moveColumn(column, -1)}>←</button><button type="button" aria-label={`${purchaseOutputColumnLabels[column]} 오른쪽 이동`} onClick={() => moveColumn(column, 1)}>→</button></span>}</div>; })}<button type="button" onClick={() => { onColumnsChange(columnDraft); setIsColumnEditorOpen(false); }}>저장</button></div>}</section>
        <footer className="purchase-helper-panel__footer"><p>파일과 품목내역은 이 작업 중에만 메모리에 유지되며 클라우드에 저장되지 않습니다.</p><div><button type="button" disabled={selectedCount === 0 || busy} onClick={() => void copy()}><ClipboardCopy size={15}/> 표 복사</button><button type="button" disabled={selectedCount === 0 || busy} onClick={() => void exportRows("csv")}>CSV 저장</button><button type="button" disabled={selectedCount === 0 || busy} onClick={() => void exportRows("xlsx")}>XLSX 저장</button></div></footer>
        </> : activeView === "draft" ? draft === null ? <section className="purchase-draft-empty"><strong>선택한 품목으로 품의문을 작성합니다.</strong><p>품목을 선택하면 합계·구매처·예산항목을 바탕으로 초안을 만듭니다.</p><button type="button" disabled={selectedCount === 0} onClick={() => onDraftChange(createPurchaseDraft(items))}>품의문 초안 만들기</button></section> : <PurchaseDraftEditor columns={columns} draft={draft} items={items} templates={draftTemplates} onChange={onDraftChange} onNotice={onNotice} onTemplatesChange={onDraftTemplatesChange} /> : settlement === null ? <section className="purchase-draft-empty"><strong>선택한 품목으로 구매결과를 정리합니다.</strong><p>품목을 선택한 뒤 구매결과 탭을 다시 열어 주세요.</p></section> : <PurchaseSettlementEditor items={items} settlement={settlement} onChange={onSettlementChange} onNotice={onNotice} />}
        {mappingCandidate !== null && headerOption !== null && <div className="purchase-mapping-backdrop"><section className="purchase-mapping-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-mapping-title"><header><div><h3 id="purchase-mapping-title">열 지정</h3><p>원본 파일의 열을 품의 항목에 연결해 주세요.</p></div><button type="button" aria-label="열 지정 닫기" onClick={() => setMappingCandidateId(null)}><X size={17}/></button></header><p className="purchase-mapping-source"><strong>{mappingCandidate.sourceName}</strong> · {mappingCandidate.sheetName}</p>{mappingCandidate.headerOptions.length > 1 && <label>머리글 행<select aria-label="머리글 행 선택" value={headerRow} onChange={(event) => { setHeaderRow(Number(event.target.value)); setMapping({}); }} >{mappingCandidate.headerOptions.map((option) => <option key={option.rowIndex} value={option.rowIndex}>{option.rowIndex + 1}행: {option.headers.filter(Boolean).join(" | ")}</option>)}</select></label>}<div className="purchase-mapping-preview"><table><tbody>{mappingCandidate.rows.slice(headerRow, headerRow + 5).map((row, rowIndex) => <tr key={rowIndex}>{headerOption.headers.map((_, columnIndex) => row[columnIndex] !== undefined && <td key={columnIndex}>{row[columnIndex]}</td>)}</tr>)}</tbody></table></div><div className="purchase-mapping-fields">{purchaseImportFieldIds.map((field) => <label key={field}>{purchaseImportFieldLabels[field]}{field === "name" ? " *" : ""}<select aria-label={`${purchaseImportFieldLabels[field]}에 연결할 원본 열`} value={mapping[field] ?? ""} onChange={(event) => { const value = event.target.value; setMapping((current) => { const next = { ...current }; if (value === "") delete next[field]; else next[field] = Number(value); return next; }); }}><option value="">사용 안 함</option>{headerOption.headers.map((header, index) => <option key={index} value={index} disabled={Object.entries(mapping).some(([other, value]) => other !== field && value === index)}>{header || `열 ${index + 1}`}</option>)}</select></label>)}</div><label className="purchase-mapping-remember"><input type="checkbox" aria-label="이 열 구성을 기억하기" checked={rememberTemplate} onChange={(event) => setRememberTemplate(event.target.checked)}/> 이 열 구성을 기억하기</label>{rememberTemplate && <input aria-label="가져오기 템플릿 이름" maxLength={40} placeholder="예: 학교장터 견적서" value={templateName} onChange={(event) => setTemplateName(event.target.value)}/>}<footer><button type="button" onClick={() => setMappingCandidateId(null)}>취소</button><button type="button" disabled={busy || mapping.name === undefined} onClick={() => void applyMapping()}>적용</button></footer></section></div>}
      </section>
    </div>
  );
}
