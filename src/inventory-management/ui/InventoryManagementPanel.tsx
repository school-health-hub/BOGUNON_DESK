import { AlertTriangle, Archive, PackageCheck, Plus, Search, ShoppingCart, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildInventorySummary, filterInventoryItems, getInventoryItemStatus, getInventoryStockTotals } from "./inventorySelectors";
import { createSyntheticInventoryAdapter } from "./syntheticAdapter";
import type { InventoryDisplayStatus, InventoryItemView, InventoryUiAdapter } from "./inventoryTypes";
import { InventoryWorkflowDialog, type InventoryWorkflow } from "./InventoryWorkflowDialog";

type ViewState = "ready" | "loading" | "empty" | "permission" | "error";
type Props = { readonly onClose: () => void; readonly adapter?: InventoryUiAdapter; readonly initialViewState?: ViewState };

const statusLabels: Record<InventoryDisplayStatus, string> = { all: "전체", normal: "정상", low_stock: "재고 부족", expiring: "유효기간 임박", expired: "만료" };
const lotLabels = { available: "사용 가능", quarantined: "격리", unavailable: "사용 불가", depleted: "소진" } as const;
const defaultSyntheticInventoryAdapter = createSyntheticInventoryAdapter();

export function InventoryManagementPanel({ onClose, adapter = defaultSyntheticInventoryAdapter, initialViewState = "ready" }: Props) {
  const [items, setItems] = useState<readonly InventoryItemView[]>([]);
  const [referenceDate, setReferenceDate] = useState("2026-11-02");
  const [viewState, setViewState] = useState<ViewState>(initialViewState === "ready" ? "loading" : initialViewState);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InventoryDisplayStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<InventoryWorkflow | null>(null);

  useEffect(() => {
    if (initialViewState !== "ready") return;
    let active = true;
    adapter.loadWorkspace().then((result) => {
      if (!active) return;
      setItems(result.items); setReferenceDate(result.referenceDate); setSelectedId(result.items[0]?.itemId ?? null); setViewState(result.items.length ? "ready" : "empty");
    }).catch(() => { if (active) setViewState("error"); });
    return () => { active = false; };
  }, [adapter, initialViewState]);

  const filtered = useMemo(() => filterInventoryItems(items, { query, status, referenceDate }), [items, query, status, referenceDate]);
  const selected = filtered.find((item) => item.itemId === selectedId) ?? filtered[0] ?? null;
  const summary = buildInventorySummary(items, referenceDate);
  const totals = selected ? getInventoryStockTotals(selected, referenceDate) : null;
  const open = (next: InventoryWorkflow) => setWorkflow(next);

  return (
    <div className="desktop-panel-backdrop inventory-management-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="inventory-management-panel" role="dialog" aria-modal="true" aria-labelledby="inventory-management-title">
        <header className="inventory-management-header"><span className="inventory-management-header__icon"><Archive size={20} /></span><div><h2 id="inventory-management-title">보건실 물품관리</h2><p>재고와 유효기간, 입고·사용 내역을 한곳에서 관리합니다.</p></div><button type="button" aria-label="보건실 물품관리 닫기" onClick={onClose}><X size={18} /></button></header>
        <div className="inventory-synthetic-banner" role="note"><AlertTriangle size={17} /><div><strong>합성 데이터 전용 화면</strong><span>현재 입력은 미리보기만 제공하며 실제 학교 재고나 서버에는 저장되지 않습니다.</span></div></div>
        <nav className="inventory-primary-actions" aria-label="물품관리 주요 동작"><button type="button" onClick={() => open("register_item")}><Plus size={16} />물품 등록</button><button type="button" onClick={() => open("receive")} disabled={!selected}><PackageCheck size={16} />입고 등록</button><button type="button" onClick={() => open("use")} disabled={!selected}>재고 사용 기록</button><button type="button" onClick={() => open("purchase_candidate")} disabled={!selected}><ShoppingCart size={16} />구매 필요 품목 확인</button></nav>
        {viewState === "loading" && <div className="inventory-state" role="status">합성 물품 목록을 불러오는 중입니다.</div>}
        {viewState === "permission" && <div className="inventory-state" role="alert"><strong>접근 권한이 없습니다.</strong><span>학교 관리자 권한을 확인해 주세요.</span></div>}
        {viewState === "error" && <div className="inventory-state" role="alert"><strong>목록을 불러오지 못했습니다.</strong><span>현재는 합성 화면만 확인할 수 있습니다.</span></div>}
        {viewState === "empty" && <div className="inventory-state"><strong>등록된 물품이 없습니다.</strong><span>물품 등록 입력을 미리 확인해 보세요.</span></div>}
        {viewState === "ready" && <main className="inventory-management-body">
          <section className="inventory-summary" aria-label="재고 요약"><article><span>전체 등록 품목</span><strong>{summary.totalItems}</strong></article><article><span>부족 품목</span><strong>{summary.lowStockItems}</strong></article><article><span>유효기간 임박</span><strong>{summary.expiringItems}</strong></article><article><span>만료 품목</span><strong>{summary.expiredItems}</strong></article></section>
          <div className="inventory-workspace">
            <section className="inventory-list" aria-label="물품 목록"><div className="inventory-list__controls"><label><span className="sr-only">물품 검색</span><Search size={16} /><input aria-label="물품 검색" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="품목명·분류·규격 검색" /></label><label><span className="sr-only">재고 상태 필터</span><select aria-label="재고 상태 필터" value={status} onChange={(event) => setStatus(event.currentTarget.value as InventoryDisplayStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
              {filtered.length === 0 ? <div className="inventory-state is-compact"><strong>검색 결과가 없습니다.</strong><span>검색어 또는 상태 필터를 바꿔 보세요.</span></div> : <div className="inventory-table-scroll"><table><thead><tr><th>분류</th><th>물품명</th><th>규격</th><th>가용/총재고</th><th>재고 상태</th></tr></thead><tbody>{filtered.map((item) => { const itemTotals = getInventoryStockTotals(item, referenceDate); const itemStatus = getInventoryItemStatus(item, referenceDate); return <tr key={item.itemId} className={selected?.itemId === item.itemId ? "is-selected" : ""}><td>{item.category}</td><th scope="row"><button type="button" onClick={() => setSelectedId(item.itemId)}>{item.name}</button></th><td>{item.specification}</td><td>{itemTotals.availableQuantity}/{itemTotals.totalQuantity}{item.baseUnit}</td><td><span className={`inventory-status is-${itemStatus}`}>{statusLabels[itemStatus]}</span></td></tr>; })}</tbody></table></div>}
            </section>
            {selected && totals && <aside className="inventory-detail" aria-label={`${selected.name} 상세`}><header><div><p>{selected.category}</p><h3>{selected.name}</h3><span>{selected.specification}</span></div><span className={`inventory-status is-${getInventoryItemStatus(selected, referenceDate)}`}>{statusLabels[getInventoryItemStatus(selected, referenceDate)]}</span></header><dl className="inventory-detail__totals"><div><dt>총재고</dt><dd>{totals.totalQuantity}{selected.baseUnit}</dd></div><div><dt>가용재고</dt><dd>{totals.availableQuantity}{selected.baseUnit}</dd></div><div><dt>권장재고</dt><dd>{selected.recommendedStock}{selected.baseUnit}</dd></div></dl><section><h4>로트별 잔량</h4><ul className="inventory-lots">{selected.lots.map((lot) => <li key={lot.lotId}><span><strong>{lot.remainingQuantity}{selected.baseUnit}</strong><small>{lot.expiresOn ?? "유효기간 없음"}</small></span><em className={`is-${lot.status}`}>{lotLabels[lot.status]}</em></li>)}</ul></section><section><h4>최근 입고·사용 이력</h4>{selected.recentHistory.length ? <ul className="inventory-history">{selected.recentHistory.map((entry) => <li key={entry.movementId}><span>{entry.description}</span><strong>{entry.quantityDelta > 0 ? "+" : ""}{entry.quantityDelta}{selected.baseUnit}</strong></li>)}</ul> : <p className="inventory-muted">표시할 합성 이력이 없습니다.</p>}</section><footer><button type="button" onClick={() => open("dispose")}>폐기</button><button type="button" onClick={() => open("adjust")}>재고 정정</button></footer></aside>}
          </div>
        </main>}
        {workflow && <InventoryWorkflowDialog workflow={workflow} item={selected} adapter={adapter} onClose={() => setWorkflow(null)} />}
      </section>
    </div>
  );
}
