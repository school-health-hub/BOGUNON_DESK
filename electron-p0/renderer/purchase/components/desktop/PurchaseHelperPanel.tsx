import {PurchaseSettlementEditor} from './PurchaseSettlementEditor';
import {PurchaseOutputPreviewDialog} from './PurchaseOutputPreviewDialog';
import {usePurchaseOutputPreview} from '../../purchase/usePurchaseOutputPreview';
import {createPurchaseSettlement} from '../../purchase/purchaseSettlement';
// Selected from Purchase source fec6deb; native workflows deliberately unavailable.
import { writePurchaseClipboard } from "../../clipboard";
import { ArrowDown, ArrowUp, ClipboardCopy, Expand, FilePlus2, FileSpreadsheet, Plus, RotateCcw, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type ReactNode } from "react";
import type { PurchaseEditingState, PurchaseItemAction, PurchaseItemPatch } from "../../purchase/purchaseItemEditing";
import { PurchaseBulkEditDialog } from "./PurchaseBulkEditDialog";
import { createPurchaseClipboard } from "../../purchase/purchaseClipboard";
import { calculatePurchaseAmountCheck, getPurchaseOutputReadiness, normalizePurchaseOutputColumns, selectedPurchaseTotal } from "../../purchase/purchaseDomain";
import { filterPurchaseItems, getPurchaseReviewCounts, purchaseReviewFilters, type PurchaseReviewFilter } from "../../purchase/purchaseReview";
import { createPurchaseDraft } from "../../purchase/purchaseDraft";
import { purchaseOutputColumnIds, purchaseOutputColumnLabels, type PurchaseDraft, type PurchaseDraftTemplate, type PurchaseOutputColumnId, type PurchaseSettlement } from "../../purchase/types";
import { PurchaseDraftEditor } from "./PurchaseDraftEditor";
import { PurchaseEditableInput } from "./PurchaseEditableInput";
import { PurchaseItemNameDialog } from "./PurchaseItemNameDialog";
type Props = {
 readonly fileControls?:ReactNode;
 readonly importSettings?:ReactNode;
 readonly settingsStatus?:ReactNode;
 readonly settingsBusy?:boolean;
 readonly settlement:PurchaseSettlement|null;
 readonly onSettlementChange:(value:PurchaseSettlement|null)=>void;
 readonly editing: PurchaseEditingState;
 readonly columns: readonly PurchaseOutputColumnId[];
 readonly draft: PurchaseDraft | null;
 readonly draftTemplates: readonly PurchaseDraftTemplate[];
 readonly onAddItem: () => void;
 readonly onEdit: Dispatch<PurchaseItemAction>;
 readonly onColumnsChange: (columns: readonly PurchaseOutputColumnId[]) => void|Promise<boolean>;
 readonly onDraftChange: (draft: PurchaseDraft | null) => void;
 readonly onDraftTemplatesChange: (templates: readonly PurchaseDraftTemplate[]) => void|Promise<boolean>;
 readonly onClose: () => void;
 readonly onNotice: (message: string) => void;
};

const numberValue = (value: string): number | null => value.trim() === "" ? null : Number(value.replace(/,/g, ""));
const formatText = (value: string): string => value;
const parseText = (value: string): string => value;
const formatNumber = (value: number | null): string => value === null ? "" : String(value);
const signedMoney = (value: number): string => `${value > 0 ? "+" : ""}${value.toLocaleString("ko-KR")}원`;
const issueLabels: Readonly<Record<string, string>> = { missingName: "품명 필요", invalidQuantity: "수량 확인", invalidUnitPrice: "단가 확인", amountMismatch: "금액 불일치" };
const reviewFilterLabels: Readonly<Record<PurchaseReviewFilter, string>> = { all: "전체", error: "오류", mismatch: "불일치", needsReview: "확인 필요" };
export function PurchaseHelperPanel({ fileControls, importSettings, settingsStatus, settingsBusy=false, settlement,onSettlementChange, editing, columns, draft, draftTemplates, onAddItem, onEdit, onColumnsChange, onDraftChange, onDraftTemplatesChange, onClose, onNotice }: Props) {
  const { items } = editing;
  const [bulkOpen, setBulkOpen] = useState(false);
  const bulkTriggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const wasBulkOpenRef = useRef(false);
  const closeBulk = () => setBulkOpen(false);
  useLayoutEffect(() => {
    if (wasBulkOpenRef.current && !bulkOpen) {
      if (bulkTriggerRef.current !== null && !bulkTriggerRef.current.disabled) bulkTriggerRef.current.focus();
      else panelRef.current?.focus();
    }
    wasBulkOpenRef.current = bulkOpen;
  }, [bulkOpen]);
  const [activeView, setActiveView] = useState<"items" | "draft" | "settlement">("items");
  const [busy,setBusy] = useState(false);
  const [showTemplates,setShowTemplates]=useState(false);
  const [isColumnEditorOpen, setIsColumnEditorOpen] = useState(false);
  const [columnDraft, setColumnDraft] = useState<readonly PurchaseOutputColumnId[]>(columns);
  const [rowFilter, setRowFilter] = useState<PurchaseReviewFilter>("all");
  const [nameDialogItemId, setNameDialogItemId] = useState<string | null>(null);
  const nameDialogTriggerRef = useRef<HTMLButtonElement | null>(null);
  const total = useMemo(() => selectedPurchaseTotal(items), [items]);
  const readiness = useMemo(() => getPurchaseOutputReadiness(items), [items]);
  const selectedCount = items.filter((item) => item.selected).length;
  const reviewCounts = useMemo(() => getPurchaseReviewCounts(items), [items]);
  const visibleRows = useMemo(() => filterPurchaseItems(items, rowFilter), [items, rowFilter]);
  const visibleSelectedCount = visibleRows.filter(({ item }) => item.selected).length;
  const hiddenSelectedCount = selectedCount - visibleSelectedCount;
  const nameDialogItem = items.find((item) => item.id === nameDialogItemId);
  const nameDialogRowNumber = nameDialogItem === undefined ? 0 : items.findIndex((item) => item.id === nameDialogItem.id) + 1;
  const closeNameDialog = () => {
    setNameDialogItemId(null);
    const trigger = nameDialogTriggerRef.current;
    if (trigger?.isConnected) trigger.focus();
  };
  const closePanel = async () => { onEdit({ type: "invalidate", reason: "패널을 닫아" }); onClose(); };
  useEffect(() => {
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!bulkOpen&&nameDialogItemId===null){onEdit({type:"invalidate",reason:"패널을 닫아"});onClose();}};
    window.addEventListener("keydown",close);return ()=>window.removeEventListener("keydown",close);
  },[bulkOpen,nameDialogItemId,onEdit,onClose]);
  const update = (id: string, patch: PurchaseItemPatch) => onEdit({ type: "patch", id, patch });
  const copy = async () => {
    if (!readiness.ready) { onNotice("입력 오류와 금액 불일치를 먼저 확인해 주세요."); return; }
    try {
      const content = createPurchaseClipboard(items, columns);
      await writePurchaseClipboard(content);
      onNotice("품목내역을 복사했습니다.");
    } catch { onNotice("품목내역을 복사하지 못했습니다."); }
  };
  const exportRows = async (format:"csv"|"xlsx") => {
    if(busy||!readiness.ready||selectedCount===0)return;
    setBusy(true);
    try{
      const result=await window.electronWork.purchase.exportItems({format,items:items.filter(i=>i.selected),columns});
      if(!result.ok){onNotice(result.error.message);return;}
      onNotice(result.data.status==='saved'?`${format.toUpperCase()} 파일을 저장했습니다: ${result.data.fileName}`:'파일 저장을 취소했습니다.');
    }catch{onNotice('파일을 저장하지 못했습니다. 기존 파일은 보존했습니다.');}finally{setBusy(false);}
  };
  const exportEdufine=async()=>{
    if(busy||!readiness.ready||!selectedCount)return;setBusy(true);
    try{const r=await window.electronWork.purchase.exportEdufine({items:items.filter(i=>i.selected)});onNotice(!r.ok?r.error.message:r.data.status==='saved'?'에듀파인 XLSX를 저장했습니다.':'에듀파인 저장을 취소했습니다.');}catch{onNotice('에듀파인 출력을 완료하지 못했습니다.');}finally{setBusy(false);}
  };
  const edufinePreview=usePurchaseOutputPreview({items,columns,revision:editing.revision,format:'edufine',onNotice,output:async()=>exportEdufine()});
  const startNew = async () => {
    if (items.length > 0 && !window.confirm("현재 품목내역과 품의문 초안을 비우고 새 작업을 시작할까요?")) return;
    onEdit({ type: "reset" }); onDraftChange(null); onSettlementChange(null); setActiveView("items"); setRowFilter("all");
  };
  const moveColumn = (column: PurchaseOutputColumnId, delta: number) => {
    const next = [...columnDraft]; const index = next.indexOf(column); const target = index + delta;
    if (index < 0 || target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; setColumnDraft(next);
  };
  return (
    <div className="desktop-panel-backdrop purchase-helper-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) void closePanel(); }}>
      <section ref={panelRef} tabIndex={-1} className="purchase-helper-panel" role="dialog" aria-modal="true" aria-labelledby="purchase-helper-title">
        <header className="purchase-helper-panel__header"><span><FileSpreadsheet size={20} /></span><div><h2 id="purchase-helper-title">품의 도우미</h2><p>품목 입력·품의문·구매결과 · 세션 전용</p></div><button type="button" aria-label="품의 도우미 닫기" onClick={() => void closePanel()}><X size={18} /></button></header>
        <div className="purchase-helper-panel__toolbar">
          {fileControls ?? <button type="button" disabled>파일 가져오기</button>}
          <button type="button" onClick={onAddItem}><Plus size={16} /> 품목 추가</button>
          <button type="button" onClick={() => void startNew()}><RotateCcw size={16} /> 새 작업</button>
          <button type="button" disabled={!importSettings||settingsBusy} onClick={()=>setShowTemplates(v=>!v)}><Settings2 size={16} /> 가져오기 설정</button>
          <span>{selectedCount}개 선택 · {total.toLocaleString("ko-KR")}원</span>
        </div>
        {settingsStatus}
        {showTemplates&&importSettings}
        <div className="purchase-helper-tabs" role="tablist" aria-label="품의 도우미 단계"><button type="button" role="tab" aria-selected={activeView === "items"} onClick={() => setActiveView("items")}>품목내역</button><button type="button" role="tab" aria-selected={activeView === "draft"} onClick={() => setActiveView("draft")}>품의문 작성</button><button type="button" role="tab" aria-selected={activeView==="settlement"} onClick={()=>{if(!readiness.ready){onNotice("입력 오류와 금액 불일치를 먼저 확인해 주세요.");return;}if(settlement===null)onSettlementChange(createPurchaseSettlement(items));setActiveView("settlement");}}>구매결과</button></div>
        {selectedCount > 0 && !readiness.ready && <div className="purchase-helper-readiness" role="status"><strong>최종 활용 전 확인이 필요합니다.</strong><span>{readiness.blockingCount > 0 && `입력 오류 ${readiness.blockingCount}건`}{readiness.blockingCount > 0 && readiness.unreviewedMismatchCount > 0 && " · "}{readiness.unreviewedMismatchCount > 0 && `금액 불일치 확인 ${readiness.unreviewedMismatchCount}건`}</span><button type="button" onClick={() => { setActiveView("items"); setRowFilter("needsReview"); }}>문제 행 확인</button></div>}
        {activeView === "items" ? <>
        <button className={`purchase-helper-dropzone${items.length > 0 ? " is-compact" : ""}`} type="button"  disabled title="Electron 파일 가져오기는 아직 지원하지 않습니다."><FilePlus2 size={items.length > 0 ? 16 : 22} /><strong>품목 추가로 직접 입력하세요.</strong><span>CSV/XLSX/XLS/텍스트 PDF는 위 가져오기 버튼을 사용하세요. 스캔 PDF OCR은 지원하지 않습니다.</span><small>계정 동기화 없음 · 앱 종료 시 품목·초안 삭제</small></button>
        <section className="purchase-helper-review" aria-label="품목 검토 필터">
          <div className="purchase-helper-review__filters">
            {purchaseReviewFilters.map((filter) => <button type="button" key={filter} aria-pressed={rowFilter === filter} onClick={() => setRowFilter(filter)}>{reviewFilterLabels[filter]} <strong>{reviewCounts[filter]}</strong></button>)}
          </div>
          <div className="purchase-helper-review__selection"><strong>{items.length}개 중 {selectedCount}개 선택</strong>{hiddenSelectedCount > 0 && <span>현재 화면에 표시되지 않은 선택 품목 {hiddenSelectedCount}개 포함</span>}<small>출력과 일괄 적용은 선택된 전체 품목을 대상으로 합니다.</small><div className="purchase-bulk-actions"><button ref={bulkTriggerRef} type="button" disabled={selectedCount === 0 || busy || bulkOpen || nameDialogItemId !== null} onClick={() => setBulkOpen(true)}>선택 품목 일괄 편집</button>{editing.undo !== null && <button type="button" disabled={busy} onClick={() => onEdit({ type: "undo", revision: editing.revision })}>마지막 일괄 적용 실행 취소</button>}</div>{editing.message !== "" && <span role="status">{editing.message}</span>}</div>
        </section>
        <div className="purchase-helper-table-wrap">
          <table className="purchase-helper-table"><thead><tr><th><input type="checkbox" aria-label="전체 품목 선택" checked={items.length > 0 && selectedCount === items.length} onChange={(event) => onEdit({ type: "select", selected: event.target.checked })} /></th><th>품명</th><th>규격</th><th>수량</th><th>단가</th><th>금액</th><th>구매처</th><th>비고</th><th>예산항목</th><th aria-label="행 작업" /></tr></thead>
            <tbody>{items.length === 0 ? <tr><td colSpan={10} className="purchase-helper-empty">파일을 가져오거나 품목을 직접 추가하세요.</td></tr> : visibleRows.length === 0 ? <tr><td colSpan={10} className="purchase-helper-empty">현재 필터에 해당하는 품목이 없습니다.</td></tr> : visibleRows.map(({ item, originalIndex }) => <tr key={item.id} className={item.issues.length > 0 ? "has-issue" : ""}>
              <td><input type="checkbox" aria-label={`${originalIndex + 1}행 선택`} checked={item.selected} onChange={(event) => onEdit({ type: "select", id: item.id, selected: event.target.checked })} /></td>
              <td><div className="purchase-helper-name-cell"><PurchaseEditableInput ariaLabel={`${originalIndex + 1}행 품명`} value={item.name} format={formatText} parse={parseText} onCommit={(name) => update(item.id, { name })} /><button type="button" aria-label={`${originalIndex + 1}행 품목명 전체 보기 및 수정`} title="품목명 전체 보기 및 수정" onClick={(event) => { nameDialogTriggerRef.current = event.currentTarget; setNameDialogItemId(item.id); }}><Expand size={13} /></button></div>{item.issues.length > 0 && <small title={item.issues.map((issue) => issueLabels[issue]).join(", ")}>{item.issues.map((issue) => issueLabels[issue]).join(" · ")}</small>}</td>
              <td><PurchaseEditableInput ariaLabel={`${originalIndex + 1}행 규격`} value={item.specification} format={formatText} parse={parseText} onCommit={(specification) => update(item.id, { specification })} /></td>
              <td><PurchaseEditableInput ariaLabel={`${originalIndex + 1}행 수량`} inputMode="decimal" value={item.quantity} format={formatNumber} parse={numberValue} onCommit={(quantity) => update(item.id, { quantity })} /></td>
              <td><PurchaseEditableInput ariaLabel={`${originalIndex + 1}행 단가`} inputMode="decimal" value={item.unitPrice} format={formatNumber} parse={numberValue} onCommit={(unitPrice) => update(item.id, { unitPrice })} /></td>
              <td className="purchase-helper-amount">{(() => {
                const amountCheck = calculatePurchaseAmountCheck(item);
                return <><span>{amountCheck.effectiveAmount?.toLocaleString("ko-KR") ?? "-"}</span>{amountCheck.difference !== null && Math.abs(amountCheck.difference) >= 1 && <><small>원본 {amountCheck.importedAmount?.toLocaleString("ko-KR")}원 · 계산 {amountCheck.computedAmount?.toLocaleString("ko-KR")}원 · 차이 {signedMoney(amountCheck.difference)}</small>{amountCheck.status === "mismatch-reviewed" ? <em>금액 확인됨</em> : <button type="button" aria-label={`${originalIndex + 1}행 금액 불일치 확인`} onClick={() => update(item.id, { amountMismatchReviewed: true })}>금액 확인</button>}</>}</>;
              })()}</td>
              <td><PurchaseEditableInput ariaLabel={`${originalIndex + 1}행 구매처`} value={item.vendor} format={formatText} parse={parseText} onCommit={(vendor) => update(item.id, { vendor })} /></td>
              <td><PurchaseEditableInput ariaLabel={`${originalIndex + 1}행 비고`} value={item.note} format={formatText} parse={parseText} onCommit={(note) => update(item.id, { note })} /></td>
              <td><PurchaseEditableInput ariaLabel={`${originalIndex + 1}행 예산항목`} value={item.budgetItem} format={formatText} parse={parseText} onCommit={(budgetItem) => update(item.id, { budgetItem })} /></td>
              <td><div className="purchase-helper-row-actions"><button type="button" aria-label={`${originalIndex + 1}행 위로 이동`} disabled={rowFilter !== "all" || originalIndex === 0} onClick={() => onEdit({ type: "move", id: item.id, delta: -1 })}><ArrowUp size={13}/></button><button type="button" aria-label={`${originalIndex + 1}행 아래로 이동`} disabled={rowFilter !== "all" || originalIndex === items.length - 1} onClick={() => onEdit({ type: "move", id: item.id, delta: 1 })}><ArrowDown size={13}/></button><button type="button" aria-label={`${originalIndex + 1}행 삭제`} onClick={() => onEdit({ type: "remove", id: item.id })}><Trash2 size={13}/></button></div></td>
            </tr>)}</tbody></table>
        </div>
        <fieldset className="purchase-helper-columns" disabled={settingsBusy} style={{border:0,borderTop:'1px solid var(--divider)',margin:0,minWidth:0}}><button type="button" disabled={settingsBusy} onClick={() => { setColumnDraft(columns); setIsColumnEditorOpen((current) => !current); }}>출력 컬럼 설정</button>{isColumnEditorOpen && <div className="purchase-helper-column-editor"><strong>출력 열</strong>{purchaseOutputColumnIds.map((column) => { const shown = columnDraft.includes(column); return <div className="purchase-helper-column" key={column}><label><input type="checkbox" checked={shown} disabled={column === "name"} onChange={(event) => setColumnDraft(normalizePurchaseOutputColumns(event.target.checked ? [...columnDraft, column] : columnDraft.filter((value) => value !== column)))} />{purchaseOutputColumnLabels[column]}</label>{shown && <span><button type="button" aria-label={`${purchaseOutputColumnLabels[column]} 왼쪽 이동`} onClick={() => moveColumn(column, -1)}>←</button><button type="button" aria-label={`${purchaseOutputColumnLabels[column]} 오른쪽 이동`} onClick={() => moveColumn(column, 1)}>→</button></span>}</div>; })}<button type="button" onClick={async () => { if(await onColumnsChange(columnDraft)!==false)setIsColumnEditorOpen(false); }}>저장</button><button type="button" onClick={()=>setIsColumnEditorOpen(false)}>취소</button></div>}</fieldset>
        <footer className="purchase-helper-panel__footer"><p>파일과 품목내역은 이 작업 중에만 메모리에 유지되며 클라우드에 저장되지 않습니다.</p><div><button type="button" disabled={selectedCount === 0 || busy || !readiness.ready} onClick={() => void copy()}><ClipboardCopy size={15}/> 표 복사</button><button type="button" disabled={selectedCount===0||busy||!readiness.ready} onClick={()=>void exportRows("csv")}>CSV 저장</button><button type="button" disabled={selectedCount===0||busy||!readiness.ready} onClick={()=>void exportRows("xlsx")}>XLSX 저장</button><button type="button" disabled={busy||!selectedCount||!readiness.ready||edufinePreview.preparing} onClick={()=>void edufinePreview.open("edufine")}>에듀파인용 Excel</button></div></footer>
        </> : activeView === "draft" ? draft === null ? <section className="purchase-draft-empty"><strong>선택한 품목으로 품의문을 작성합니다.</strong><p>품목을 선택하면 합계·구매처·예산항목을 바탕으로 초안을 만듭니다.</p><button type="button" disabled={selectedCount === 0 || !readiness.ready} onClick={() => onDraftChange(createPurchaseDraft(items))}>품의문 초안 만들기</button></section> : <PurchaseDraftEditor settingsBusy={settingsBusy} columns={columns} draft={draft} items={items} outputReady={readiness.ready} templates={draftTemplates} onChange={onDraftChange} onNotice={onNotice} onTemplatesChange={onDraftTemplatesChange} /> : settlement===null?null:<PurchaseSettlementEditor items={items} outputReady={readiness.ready} settlement={settlement} onChange={onSettlementChange} onNotice={onNotice}/>}

        {edufinePreview.snapshot!==null&&<PurchaseOutputPreviewDialog snapshot={edufinePreview.snapshot} currentKey={edufinePreview.currentKey} busy={edufinePreview.outputting} onClose={edufinePreview.close} onOutput={()=>void edufinePreview.output()}/>}
        {nameDialogItem !== undefined && <PurchaseItemNameDialog itemName={nameDialogItem.name} rowNumber={nameDialogRowNumber} onCancel={closeNameDialog} onSave={(name) => { update(nameDialogItem.id, { name }); closeNameDialog(); }} />}
        {bulkOpen && <PurchaseBulkEditDialog items={items} revision={editing.revision} hiddenSelectedCount={hiddenSelectedCount} busy={busy} onCancel={closeBulk} onApply={(request) => { onEdit({ type: "bulk", request }); closeBulk(); }} />}
      </section>
    </div>
  );
}
