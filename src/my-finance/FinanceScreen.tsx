import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, CircleDollarSign, Clock3, LockKeyhole, Pencil, Plus, RefreshCw, Trash2, Wallet } from "lucide-react";
import { createFinanceIncome, deleteFinanceIncome, listFinanceIncome, replaceFinancePhase2, updateFinanceIncome, type FinanceIdentity, type FinanceSnapshot } from "./repository";
import { emptyPhase2Data, type IncomeRecord, type Phase2Data } from "./domain";
import { deductionLabels, editIncomeForm, emptyIncomeForm, formatKrw, incomeLabels, isFinanceConflict, selectIncome, taxLabels, type IncomeFilter, type IncomeFormValue } from "./presentation";
import { IncomeForm } from "./IncomeForm";
import { FinanceConfirmation } from "./FinanceConfirmation";
import { FinanceTransfer } from "./FinanceTransfer";
import { Phase2Workspace } from "./Phase2Workspace";
import "./finance.css";

type Editor = { value: IncomeFormValue; expected: FinanceIdentity; editing: boolean };
type Confirmation = { kind: "save"; entry: IncomeRecord; expected: FinanceIdentity; editing: boolean } | { kind: "delete"; id: string; expected: FinanceIdentity } | { kind: "reload" | "leave" | "discard" };
const titles = { save: "수입을 저장할까요?", delete: "수입을 삭제할까요?", reload: "최신 목록을 불러올까요?", leave: "보건 업무로 돌아갈까요?", discard: "입력을 취소할까요?" };
const messages = { save: "입력한 내용을 이 PC의 암호화 저장소에 저장합니다.", delete: "선택한 수입을 삭제합니다. 이 작업은 되돌릴 수 없습니다.", reload: "작성 중인 내용을 버리고 최신 목록을 불러옵니다. 충돌한 편집은 자동으로 덮어쓰지 않습니다.", leave: "저장하지 않은 입력 내용은 사라집니다.", discard: "저장하지 않은 입력 내용을 버립니다." };

export function FinanceScreen({ onClose, qa = false }: { onClose: () => void; qa?: boolean }) {
  const [transferOpen, setTransferOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<FinanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [kind, setKind] = useState<IncomeFilter>("all");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [workspace, setWorkspace] = useState<"income" | "planning">("income");
  const mounted = useRef(false);
  const sequence = useRef(0);
  const locked = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  function ask(plan: Confirmation) {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmation(plan);
  }

  async function reload() {
    if (locked.current) return;
    const token = ++sequence.current;
    setLoading(true); setNotice(null);
    try {
      const next = await listFinanceIncome();
      if (!mounted.current || token !== sequence.current) return;
      setSnapshot(next); setStale(false); setError(null); setEditor(null); setDirty(false); setPage(1);
    } catch {
      if (mounted.current && token === sequence.current) { setError("금융 저장소를 열지 못했습니다. Windows 앱의 로컬 저장소를 확인한 뒤 다시 시도해 주세요."); setStale(true); }
    } finally { if (mounted.current && token === sequence.current) setLoading(false); }
  }
  useEffect(() => {
    mounted.current = true; heading.current?.focus(); void reload();
    return () => { mounted.current = false; sequence.current++; };
  }, []);

  const writable = snapshot !== null && !loading && !busy && !stale;
  function close() { if (locked.current) return; if (dirty) ask({ kind: "leave" }); else onClose(); }
  function refresh() { if (locked.current || loading) return; if (dirty) ask({ kind: "reload" }); else void reload(); }
  async function confirm() {
    const plan = confirmation;
    if (!plan || locked.current) return;
    if (plan.kind === "leave") { onClose(); return; }
    if (plan.kind === "discard") { setEditor(null); setDirty(false); setConfirmation(null); return; }
    if (plan.kind === "reload") { setConfirmation(null); void reload(); return; }
    if (!writable || (plan.kind !== "save" && plan.kind !== "delete")) return;
    locked.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      const next = plan.kind === "delete" ? await deleteFinanceIncome(plan.expected, plan.id)
        : plan.editing ? await updateFinanceIncome(plan.expected, plan.entry) : await createFinanceIncome(plan.expected, plan.entry);
      if (!mounted.current) return;
      setSnapshot(next); setEditor(null); setDirty(false); setPage(1);
      if (plan.kind === "save") { setYear(Number(plan.entry.earnedOn.slice(0, 4))); setKind("all"); }
      setNotice(plan.kind === "delete" ? "수입을 삭제했습니다." : plan.editing ? "수입을 수정했습니다." : "수입을 등록했습니다.");
    } catch (caught) {
      if (!mounted.current) return;
      // Any failed/uncertain write requires an explicit refresh, never a retry.
      setStale(true);
      setError(isFinanceConflict(caught) ? "다른 작업에서 금융 데이터가 변경되었습니다. 최신 목록을 새로고침한 뒤 다시 편집해 주세요." : "저장하지 못했습니다. 최신 목록을 새로고침해 저장 상태를 확인한 뒤 다시 시도해 주세요.");
    } finally { locked.current = false; if (mounted.current) { setBusy(false); setConfirmation(null); } }
  }

  const years = [...new Set([year, new Date().getFullYear(), new Date().getFullYear() - 1, ...(snapshot?.income.map((r) => Number(r.earnedOn.slice(0, 4))) ?? [])])].sort((a, b) => b - a);
  let selected: ReturnType<typeof selectIncome> | null = null;
  if (snapshot) selected = selectIncome(snapshot.income, year, kind);
  const summaryError = selected !== null && selected.summary === null;
  const pages = Math.max(1, Math.ceil((selected?.records.length ?? 0) / 20));
  const currentPage = Math.min(page, pages);
  const summary = selected?.summary;
  const startEdit = (entry?: IncomeRecord) => {
    if (!writable || editor || !snapshot) return;
    setNotice(null); setDirty(false);
    setEditor({ value: entry ? editIncomeForm(entry) : emptyIncomeForm(), expected: snapshot.identity, editing: entry !== undefined });
  };
  const savePhase2 = async (phase2: Phase2Data) => {
    if (!snapshot || !writable || locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try { const next = await replaceFinancePhase2(snapshot.identity, phase2); if (mounted.current) { setSnapshot(next); setNotice("세금·투자·자산 정보를 암호화 저장소에 저장했습니다."); } }
    catch { if (mounted.current) { setStale(true); setError("저장 상태를 확인하지 못했습니다. 새로고침 후 다시 확인해 주세요."); } throw new Error("phase2-save-failed"); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  return <div className="finance-screen" onKeyDown={(e) => e.stopPropagation()}>
    <div className="finance-container" inert={confirmation !== null || transferOpen}>
      <header className="finance-header"><button type="button" className="finance-back" onClick={close} disabled={busy}><ArrowLeft size={16} /> {qa ? "QA 앱 종료" : "보건 업무로"}</button><span className="finance-local"><LockKeyhole size={14} /> 이 PC에만 저장</span></header>
      <main>
        <section className="finance-hero"><div><p className="finance-eyebrow">MY FINANCE</p><h1 ref={heading} tabIndex={-1}>내 수입, 한눈에</h1><p>발생부터 입금까지, 개인 수입을 차분하게 정리하세요.</p></div><div className="finance-hero-actions"><button type="button" disabled={!writable || editor !== null} onClick={() => setTransferOpen(true)}>백업·복원</button><button type="button" aria-label="최신 목록 새로고침" onClick={refresh} disabled={loading || busy}><RefreshCw size={16} /> 새로고침</button><button type="button" className="finance-primary" disabled={!writable || editor !== null} onClick={() => startEdit()}><Plus size={16} /> 수입 등록</button></div></section>
        <p className="finance-beta-note"><LockKeyhole size={15} /><span><strong>개발 검증 단계</strong> · 실제 두 PC 간 이동 및 장애 복구 수동 검증이 끝나기 전입니다. 아직 실제 금융정보를 입력하지 마세요. 클라우드 동기화는 지원하지 않습니다.</span></p>
        {error && <div role="alert" className="finance-error"><strong>{stale ? "최신 상태 확인이 필요합니다" : "저장소 연결 확인"}</strong><p>{error}</p>{snapshot && <p>아래 내역은 마지막 조회 결과입니다. 확인 전에는 변경할 수 없습니다.</p>}<button type="button" onClick={refresh} disabled={loading || busy}>최신 목록 새로고침</button></div>}
        {notice && <p role="status" className="finance-success">{notice}</p>}
        <nav className="finance-area-tabs" aria-label="MY FINANCE 영역"><button type="button" className={workspace === "income" ? "is-active" : ""} onClick={() => setWorkspace("income")}>수입 관리</button><button type="button" className={workspace === "planning" ? "is-active" : ""} onClick={() => setWorkspace("planning")}>세금·투자·자산</button></nav>
        {workspace === "planning" && snapshot && <Phase2Workspace income={snapshot.income} value={snapshot.phase2 ?? emptyPhase2Data()} disabled={!writable} onSave={savePhase2} />}
        {workspace === "income" && <>
        <div className="finance-filters"><label>연도<select value={year} onChange={(e) => { setYear(Number(e.target.value)); setPage(1); }}>{years.map((y) => <option key={y} value={y}>{y}년</option>)}</select></label><label>수입 유형 필터<select value={kind} onChange={(e) => { setKind(e.target.value as IncomeFilter); setPage(1); }}><option value="all">전체 수입</option>{Object.entries(incomeLabels).map(([k, v]) => <option value={k} key={k}>{v}</option>)}</select></label><p>수입 발생일 기준 · {kind === "all" ? "전체 유형" : incomeLabels[kind]}</p></div>
        <section className="finance-summary" aria-label="연간 수입 집계" aria-busy={loading}>
          {[
            { label: "총수입", amount: summary ? formatKrw(summary.grossKrw) : "—", icon: Wallet, tone: "blue" },
            { label: "공제액", amount: summary ? formatKrw(summary.deductionsKrw) : "—", icon: ArrowUpRight, tone: "lavender" },
            { label: "실수령액", amount: summary ? formatKrw(summary.netKrw) : "—", icon: CircleDollarSign, tone: "mint" },
            { label: "미입금", amount: summary ? `${summary.unpaidCount}건` : "—", icon: Clock3, tone: "peach" },
          ].map(({ label, amount, icon: Icon, tone }) => <div className={`finance-summary-card finance-tone-${tone}`} key={label}><span><Icon size={17} />{label}</span><strong>{loading ? "—" : amount}</strong><small>{year}년 {kind === "all" ? "전체 수입" : incomeLabels[kind]}</small></div>)}
        </section>
        {summaryError && <p role="alert" className="finance-error">연간 합계가 계산 가능한 범위를 초과했습니다. 합계 금액은 표시하지 않습니다.</p>}
        <div className={`finance-workspace${editor ? " has-editor" : ""}`}>
          <section className="finance-list" aria-label="수입 목록" aria-busy={loading}>
            <div className="finance-section-line"><h2>수입 내역 <span>{selected?.records.length ?? "—"}</span></h2><small>선택한 연도와 유형의 내역</small></div>
            {loading ? <div className="finance-empty" role="status"><RefreshCw size={24} /><h3>암호화 저장소를 불러오는 중입니다</h3><p>잠시만 기다려 주세요.</p></div>
              : !snapshot ? <div className="finance-empty"><LockKeyhole size={28} /><h3>Windows 앱에서 시작해 주세요</h3><p>금융정보는 이 PC의 암호화 저장소에서만 읽고 씁니다.</p></div>
              : !selected ? null : selected.records.length === 0 ? <div className="finance-empty"><Wallet size={30} /><h3>{snapshot.income.length === 0 ? "아직 등록된 수입이 없습니다" : "조건에 맞는 수입이 없습니다"}</h3><p>{snapshot.income.length === 0 ? "수입을 등록하면 연간 집계와 입금 상태를 함께 확인할 수 있어요." : "연도나 수입 유형을 변경해 보세요."}</p></div>
              : selected.records.slice((currentPage - 1) * 20, currentPage * 20).map((entry) => <article className="finance-income" key={entry.id} aria-label="수입 항목">
                <div className="finance-income-heading"><div><span className={`finance-kind finance-kind-${entry.incomeKind}`}>{incomeLabels[entry.incomeKind]}</span><h3>{entry.sourceName}</h3><p>{entry.contractLabel || "계약 명목 없음"}</p></div><span className={entry.paidOn ? "finance-paid" : "finance-unpaid"}>{entry.paidOn ? "입금 완료" : "미입금"}</span></div>
                <dl className="finance-income-amounts"><div><dt>총수입</dt><dd>{formatKrw(entry.grossKrw)}</dd></div><div><dt>공제액</dt><dd>{formatKrw(entry.grossKrw - entry.netKrw)}</dd></div><div><dt>실수령액</dt><dd>{formatKrw(entry.netKrw)}</dd></div></dl>
                <div className="finance-income-footer"><span>발생 {entry.earnedOn} · 입금 {entry.paidOn ?? "미정"}</span><div><button type="button" aria-label="수입 수정" disabled={!writable || editor !== null} onClick={() => startEdit(entry)}><Pencil size={14} /> 수정</button><button type="button" aria-label="수입 삭제" disabled={!writable || editor !== null} onClick={() => snapshot && ask({ kind: "delete", id: entry.id, expected: snapshot.identity })}><Trash2 size={14} /> 삭제</button></div></div>
                <details><summary>공제·세무·메모</summary><dl className="finance-income-detail"><div><dt>공제 내역</dt><dd>{entry.deductions.length === 0 ? "없음" : entry.deductions.map((d, i) => <span key={i}>{deductionLabels[d.kind]} {formatKrw(d.amountKrw)}</span>)}</dd></div><div><dt>세무 분류</dt><dd>{taxLabels[entry.taxCategory]} · {entry.taxCategoryVerified ? "증빙 확인" : "미확정"}</dd></div><div><dt>메모</dt><dd>{entry.notes || "없음"}</dd></div></dl></details>
              </article>)}
            {pages > 1 && <nav className="finance-pagination" aria-label="수입 목록 페이지"><button type="button" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>이전</button><span>{currentPage} / {pages}</span><button type="button" disabled={currentPage >= pages} onClick={() => setPage((p) => p + 1)}>다음</button></nav>}
          </section>
          {editor && <IncomeForm key={editor.value.id} initial={editor.value} editing={editor.editing} disabled={!writable} onDirty={() => setDirty(true)} onCancel={() => dirty ? ask({ kind: "discard" }) : setEditor(null)} onSave={(entry) => ask({ kind: "save", entry, expected: editor.expected, editing: editor.editing })} />}
        </div>
        </>}
      </main><footer className="finance-page-footer">개인 수입 전용 공간 · 학교 업무 및 계정 설정과 별도로 관리합니다.</footer>
    </div>
    {transferOpen && snapshot && <FinanceTransfer snapshot={snapshot} onClose={() => setTransferOpen(false)} onRestored={(next) => { setSnapshot(next); setEditor(null); setDirty(false); setPage(1); setError(null); setStale(false); setNotice("암호화 백업을 복원했습니다."); }} onUncertain={() => { setStale(true); setError("복원 상태 확인을 위해 최신 목록을 새로고침해 주세요."); }} />}
    {confirmation && <FinanceConfirmation returnFocus={returnFocus.current} title={titles[confirmation.kind]} message={messages[confirmation.kind]} confirmLabel={confirmation.kind === "delete" ? "삭제" : confirmation.kind === "save" ? "로컬 저장" : "확인"} busy={busy} destructive={confirmation.kind === "delete"} onCancel={() => { if (!locked.current) setConfirmation(null); }} onConfirm={() => void confirm()} />}
  </div>;
}
