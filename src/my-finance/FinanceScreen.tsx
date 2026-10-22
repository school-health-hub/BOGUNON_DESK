import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CircleDollarSign,
  Clock3,
  DatabaseBackup,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  createFinanceIncome,
  deleteFinanceIncome,
  listFinanceIncome,
  replaceFinancePhase2,
  updateFinanceIncome,
  type FinanceIdentity,
  type FinanceSnapshot,
} from "./repository";
import { emptyPhase2Data, type IncomeRecord, type Phase2Data } from "./domain";
import {
  deductionLabels,
  editIncomeForm,
  emptyIncomeForm,
  formatKrw,
  incomeLabels,
  isFinanceConflict,
  selectIncome,
  taxLabels,
  type IncomeFilter,
  type IncomeFormValue,
} from "./presentation";
import { IncomeForm } from "./IncomeForm";
import { FinanceConfirmation } from "./FinanceConfirmation";
import { FinanceTransfer } from "./FinanceTransfer";
import { Phase2Workspace } from "./Phase2Workspace";
import { FinanceHome } from "./FinanceHome";
import {
  FinanceWorkspaceShell,
  type FinanceSection,
} from "./FinanceWorkspaceShell";
import "./finance.css";
import "./finance-v2.css";

type Editor = {
  value: IncomeFormValue;
  expected: FinanceIdentity;
  editing: boolean;
};
type Confirmation =
  | {
      kind: "save";
      entry: IncomeRecord;
      expected: FinanceIdentity;
      editing: boolean;
    }
  | { kind: "delete"; id: string; expected: FinanceIdentity }
  | { kind: "phase2-discard"; action: "leave" | "reload" | "section"; section?: FinanceSection }
  | { kind: "reload" | "leave" | "discard" };
const titles = {
  save: "수입을 저장할까요?",
  delete: "수입을 삭제할까요?",
  reload: "최신 목록을 불러올까요?",
  leave: "보건 업무로 돌아갈까요?",
  discard: "입력을 취소할까요?",
  "phase2-discard": "작성 중인 금융 입력을 버릴까요?",
};
const messages = {
  save: "입력한 내용을 이 PC의 암호화 저장소에 저장합니다.",
  delete: "선택한 수입을 삭제합니다. 이 작업은 되돌릴 수 없습니다.",
  reload:
    "작성 중인 내용을 버리고 최신 목록을 불러옵니다. 충돌한 편집은 자동으로 덮어쓰지 않습니다.",
  leave: "저장하지 않은 입력 내용은 사라집니다.",
  discard: "저장하지 않은 입력 내용을 버립니다.",
  "phase2-discard": "작성 중인 투자·자산 입력을 버리고 계속합니다.",
};

export function FinanceScreen({
  onClose,
  qa = false,
}: {
  onClose: () => void;
  qa?: boolean;
}) {
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
  const [phase2Dirty, setPhase2Dirty] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [section, setSection] = useState<FinanceSection>("home");
  const [pendingSection, setPendingSection] = useState<FinanceSection | null>(
    null,
  );
  const mounted = useRef(false);
  const sequence = useRef(0);
  const locked = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  function ask(plan: Confirmation) {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setConfirmation(plan);
  }

  async function reload() {
    if (locked.current) return;
    const token = ++sequence.current;
    setLoading(true);
    setNotice(null);
    try {
      const next = await listFinanceIncome();
      if (!mounted.current || token !== sequence.current) return;
      setSnapshot(next);
      setStale(false);
      setError(null);
      setEditor(null);
      setDirty(false);
      setPage(1);
    } catch {
      if (mounted.current && token === sequence.current) {
        setError(
          "금융 저장소를 열지 못했습니다. Windows 앱의 로컬 저장소를 확인한 뒤 다시 시도해 주세요.",
        );
        setStale(true);
      }
    } finally {
      if (mounted.current && token === sequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
      sequence.current++;
    };
  }, []);

  const writable = snapshot !== null && !loading && !busy && !stale;
  function close() {
    if (locked.current) return;
    if (phase2Dirty) { ask({ kind: "phase2-discard", action: "leave" }); return; }
    if (dirty) ask({ kind: "leave" });
    else onClose();
  }
  function refresh() {
    if (locked.current || loading) return;
    if (phase2Dirty) { ask({ kind: "phase2-discard", action: "reload" }); return; }
    if (dirty) ask({ kind: "reload" });
    else void reload();
  }
  async function confirm() {
    const plan = confirmation;
    if (!plan || locked.current) return;
    if (plan.kind === "leave") {
      onClose();
      return;
    }
    if (plan.kind === "discard") {
      setEditor(null);
      setDirty(false);
      setConfirmation(null);
      if (pendingSection) {
        setSection(pendingSection);
        setPendingSection(null);
      }
      return;
    }
    if (plan.kind === "phase2-discard") {
      setPhase2Dirty(false);
      setConfirmation(null);
      if (plan.action === "leave") onClose();
      else if (plan.action === "reload") void reload();
      else if (plan.section) setSection(plan.section);
      return;
    }
    if (plan.kind === "reload") {
      setConfirmation(null);
      void reload();
      return;
    }
    if (!writable || (plan.kind !== "save" && plan.kind !== "delete")) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next =
        plan.kind === "delete"
          ? await deleteFinanceIncome(plan.expected, plan.id)
          : plan.editing
            ? await updateFinanceIncome(plan.expected, plan.entry)
            : await createFinanceIncome(plan.expected, plan.entry);
      if (!mounted.current) return;
      setSnapshot(next);
      setEditor(null);
      setDirty(false);
      setPage(1);
      if (plan.kind === "save") {
        setYear(Number(plan.entry.earnedOn.slice(0, 4)));
        setKind("all");
      }
      setNotice(
        plan.kind === "delete"
          ? "수입을 삭제했습니다."
          : plan.editing
            ? "수입을 수정했습니다."
            : "수입을 등록했습니다.",
      );
    } catch (caught) {
      if (!mounted.current) return;
      // Any failed/uncertain write requires an explicit refresh, never a retry.
      setStale(true);
      setError(
        isFinanceConflict(caught)
          ? "다른 작업에서 금융 데이터가 변경되었습니다. 최신 목록을 새로고침한 뒤 다시 편집해 주세요."
          : "저장하지 못했습니다. 최신 목록을 새로고침해 저장 상태를 확인한 뒤 다시 시도해 주세요.",
      );
    } finally {
      locked.current = false;
      if (mounted.current) {
        setBusy(false);
        setConfirmation(null);
      }
    }
  }

  const years = [
    ...new Set([
      year,
      new Date().getFullYear(),
      new Date().getFullYear() - 1,
      ...(snapshot?.income.map((r) => Number(r.earnedOn.slice(0, 4))) ?? []),
    ]),
  ].sort((a, b) => b - a);
  let selected: ReturnType<typeof selectIncome> | null = null;
  if (snapshot) selected = selectIncome(snapshot.income, year, kind);
  const summaryError = selected !== null && selected.summary === null;
  const pages = Math.max(1, Math.ceil((selected?.records.length ?? 0) / 20));
  const currentPage = Math.min(page, pages);
  const summary = selected?.summary;
  const startEdit = (entry?: IncomeRecord) => {
    if (!writable || editor || !snapshot) return;
    setSection("income");
    setNotice(null);
    setDirty(false);
    setEditor({
      value: entry ? editIncomeForm(entry) : emptyIncomeForm(),
      expected: snapshot.identity,
      editing: entry !== undefined,
    });
  };
  const savePhase2 = async (phase2: Phase2Data) => {
    if (!snapshot || !writable || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await replaceFinancePhase2(snapshot.identity, phase2);
      if (mounted.current) {
        setSnapshot(next);
        setNotice("세금·투자·자산 정보를 암호화 저장소에 저장했습니다.");
      }
    } catch {
      if (mounted.current) {
        setStale(true);
        setError(
          "저장 상태를 확인하지 못했습니다. 새로고침 후 다시 확인해 주세요.",
        );
      }
      throw new Error("phase2-save-failed");
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const changeSection = (next: FinanceSection) => {
    if (next === section) return;
    if (phase2Dirty) { ask({ kind: "phase2-discard", action: "section", section: next }); return; }
    if (editor && dirty) {
      setPendingSection(next);
      ask({ kind: "discard" });
      return;
    }
    setEditor(null);
    setDirty(false);
    setSection(next);
  };
  return (
    <div className="finance-screen" onKeyDown={(e) => e.stopPropagation()}>
      <div
        className="finance-container"
        inert={confirmation !== null || transferOpen}
      >
        <FinanceWorkspaceShell
          section={section}
          onSectionChange={changeSection}
          onClose={close}
          onRefresh={refresh}
          qa={qa}
          loading={loading}
          busy={busy}
        >
          <p className="finance-beta-note">
            <LockKeyhole size={15} />
            <span>
              <strong>개발 검증 단계</strong> · 실제 두 PC 간 이동 및 장애 복구
              수동 검증이 끝나기 전입니다. 아직 실제 금융정보를 입력하지 마세요.
              클라우드 동기화는 지원하지 않습니다.
            </span>
          </p>
          {error && (
            <div role="alert" className="finance-error">
              <strong>
                {stale ? "최신 상태 확인이 필요합니다" : "저장소 연결 확인"}
              </strong>
              <p>{error}</p>
              {snapshot && (
                <p>
                  아래 내역은 마지막 조회 결과입니다. 확인 전에는 변경할 수
                  없습니다.
                </p>
              )}
              <button
                type="button"
                onClick={refresh}
                disabled={loading || busy}
              >
                최신 목록 새로고침
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className="finance-success">
              {notice}
            </p>
          )}
          {loading && !snapshot && (
            <div className="finance-page-state" role="status">
              <RefreshCw size={22} />
              <h1>암호화 저장소를 불러오는 중입니다</h1>
              <p>이 PC의 금융 데이터를 안전하게 확인하고 있습니다.</p>
            </div>
          )}
          {section === "home" && snapshot && (
            <FinanceHome
              snapshot={snapshot}
              onNavigate={changeSection}
              onAddIncome={() => startEdit()}
              writable={writable}
            />
          )}
          {(section === "tax" ||
            section === "investments" ||
            section === "assets") &&
            snapshot && (
              <>
                <header className="finance-view-header">
                  <div>
                    <p className="finance-eyebrow">MY FINANCE</p>
                    <h1>
                      {section === "tax"
                        ? "세금 관리"
                        : section === "investments"
                          ? "투자 관리"
                          : "자산·부채"}
                    </h1>
                    <p>
                      {section === "tax"
                        ? "소득과 원천징수 내역을 신고 준비 참고자료로 확인합니다."
                        : section === "investments"
                          ? "보유 현황, 거래, 배당과 계좌 설정을 관리합니다."
                          : "현금성 자산과 부채를 기준일별로 관리합니다."}
                    </p>
                  </div>
                </header>
                <Phase2Workspace
                  key={section}
                  initialSection={section}
                  hideNavigation
                  income={snapshot.income}
                  value={snapshot.phase2 ?? emptyPhase2Data()}
                  disabled={!writable}
                  onSave={savePhase2}
                  onDirtyChange={setPhase2Dirty}
                />
              </>
            )}
          {section === "backup" && (
            <section className="finance-backup-page">
              <header className="finance-view-header">
                <div>
                  <p className="finance-eyebrow">LOCAL ENCRYPTED BACKUP</p>
                  <h1>백업·복원</h1>
                  <p>
                    금융 데이터는 암호화된 .bgfnbk 파일로만 내보낼 수 있습니다.
                  </p>
                </div>
              </header>
              <div className="finance-backup-card">
                <DatabaseBackup size={28} />
                <div>
                  <h2>암호화 백업과 안전 복원</h2>
                  <p>
                    기존 비밀번호 검증, 복원 미리보기, revision·dataset 비교와
                    안전 스냅샷 절차를 그대로 사용합니다.
                  </p>
                </div>
                <button
                  type="button"
                  className="finance-primary"
                  disabled={!writable}
                  onClick={() => setTransferOpen(true)}
                >
                  백업·복원 열기
                </button>
              </div>
            </section>
          )}
          {section === "income" && (
            <>
              <header className="finance-view-header">
                <div>
                  <p className="finance-eyebrow">INCOME</p>
                  <h1>수입 관리</h1>
                  <p>
                    목록을 확인하고 필요한 경우에만 등록·수정 패널을 엽니다.
                  </p>
                </div>
                <button
                  type="button"
                  className="finance-primary"
                  disabled={!writable || editor !== null}
                  onClick={() => startEdit()}
                >
                  <Plus size={16} /> 수입 등록
                </button>
              </header>
              <div className="finance-filters">
                <label>
                  연도
                  <select
                    value={year}
                    onChange={(e) => {
                      setYear(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}년
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  수입 유형 필터
                  <select
                    value={kind}
                    onChange={(e) => {
                      setKind(e.target.value as IncomeFilter);
                      setPage(1);
                    }}
                  >
                    <option value="all">전체 수입</option>
                    {Object.entries(incomeLabels).map(([k, v]) => (
                      <option value={k} key={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  수입 발생일 기준 ·{" "}
                  {kind === "all" ? "전체 유형" : incomeLabels[kind]}
                </p>
              </div>
              <section
                className="finance-summary"
                aria-label="연간 수입 집계"
                aria-busy={loading}
              >
                {[
                  {
                    label: "총수입",
                    amount: summary ? formatKrw(summary.grossKrw) : "—",
                    icon: Wallet,
                    tone: "blue",
                  },
                  {
                    label: "공제액",
                    amount: summary ? formatKrw(summary.deductionsKrw) : "—",
                    icon: ArrowUpRight,
                    tone: "lavender",
                  },
                  {
                    label: "실수령액",
                    amount: summary ? formatKrw(summary.netKrw) : "—",
                    icon: CircleDollarSign,
                    tone: "mint",
                  },
                  {
                    label: "미입금",
                    amount: summary ? `${summary.unpaidCount}건` : "—",
                    icon: Clock3,
                    tone: "peach",
                  },
                ].map(({ label, amount, icon: Icon, tone }) => (
                  <div
                    className={`finance-summary-card finance-tone-${tone}`}
                    key={label}
                  >
                    <span>
                      <Icon size={17} />
                      {label}
                    </span>
                    <strong>{loading ? "—" : amount}</strong>
                    <small>
                      {year}년{" "}
                      {kind === "all" ? "전체 수입" : incomeLabels[kind]}
                    </small>
                  </div>
                ))}
              </section>
              {summaryError && (
                <p role="alert" className="finance-error">
                  연간 합계가 계산 가능한 범위를 초과했습니다. 합계 금액은
                  표시하지 않습니다.
                </p>
              )}
              <div
                className={`finance-workspace${editor ? " has-editor" : ""}`}
              >
                <section
                  className="finance-list"
                  aria-label="수입 목록"
                  aria-busy={loading}
                >
                  <div className="finance-section-line">
                    <h2>
                      수입 내역 <span>{selected?.records.length ?? "—"}</span>
                    </h2>
                    <small>선택한 연도와 유형의 내역</small>
                  </div>
                  {loading ? (
                    <div className="finance-empty" role="status">
                      <RefreshCw size={24} />
                      <h3>암호화 저장소를 불러오는 중입니다</h3>
                      <p>잠시만 기다려 주세요.</p>
                    </div>
                  ) : !snapshot ? (
                    <div className="finance-empty">
                      <LockKeyhole size={28} />
                      <h3>Windows 앱에서 시작해 주세요</h3>
                      <p>금융정보는 이 PC의 암호화 저장소에서만 읽고 씁니다.</p>
                    </div>
                  ) : !selected ? null : selected.records.length === 0 ? (
                    <div className="finance-empty">
                      <Wallet size={30} />
                      <h3>
                        {snapshot.income.length === 0
                          ? "아직 등록된 수입이 없습니다"
                          : "조건에 맞는 수입이 없습니다"}
                      </h3>
                      <p>
                        {snapshot.income.length === 0
                          ? "수입을 등록하면 연간 집계와 입금 상태를 함께 확인할 수 있어요."
                          : "연도나 수입 유형을 변경해 보세요."}
                      </p>
                    </div>
                  ) : (
                    selected.records
                      .slice((currentPage - 1) * 20, currentPage * 20)
                      .map((entry) => (
                        <article
                          className="finance-income"
                          key={entry.id}
                          aria-label="수입 항목"
                        >
                          <div className="finance-income-heading">
                            <div>
                              <span
                                className={`finance-kind finance-kind-${entry.incomeKind}`}
                              >
                                {incomeLabels[entry.incomeKind]}
                              </span>
                              <h3>{entry.sourceName}</h3>
                              <p>{entry.contractLabel || "계약 명목 없음"}</p>
                            </div>
                            <span
                              className={
                                entry.paidOn ? "finance-paid" : "finance-unpaid"
                              }
                            >
                              {entry.paidOn ? "입금 완료" : "미입금"}
                            </span>
                          </div>
                          <dl className="finance-income-amounts">
                            <div>
                              <dt>총수입</dt>
                              <dd>{formatKrw(entry.grossKrw)}</dd>
                            </div>
                            <div>
                              <dt>공제액</dt>
                              <dd>
                                {formatKrw(entry.grossKrw - entry.netKrw)}
                              </dd>
                            </div>
                            <div>
                              <dt>실수령액</dt>
                              <dd>{formatKrw(entry.netKrw)}</dd>
                            </div>
                          </dl>
                          <div className="finance-income-footer">
                            <span>
                              발생 {entry.earnedOn} · 입금{" "}
                              {entry.paidOn ?? "미정"}
                            </span>
                            <div>
                              <button
                                type="button"
                                aria-label="수입 수정"
                                disabled={!writable || editor !== null}
                                onClick={() => startEdit(entry)}
                              >
                                <Pencil size={14} /> 수정
                              </button>
                              <button
                                type="button"
                                aria-label="수입 삭제"
                                disabled={!writable || editor !== null}
                                onClick={() =>
                                  snapshot &&
                                  ask({
                                    kind: "delete",
                                    id: entry.id,
                                    expected: snapshot.identity,
                                  })
                                }
                              >
                                <Trash2 size={14} /> 삭제
                              </button>
                            </div>
                          </div>
                          <details>
                            <summary>공제·세무·메모</summary>
                            <dl className="finance-income-detail">
                              <div>
                                <dt>공제 내역</dt>
                                <dd>
                                  {entry.deductions.length === 0
                                    ? "없음"
                                    : entry.deductions.map((d, i) => (
                                        <span key={i}>
                                          {deductionLabels[d.kind]}{" "}
                                          {formatKrw(d.amountKrw)}
                                        </span>
                                      ))}
                                </dd>
                              </div>
                              <div>
                                <dt>세무 분류</dt>
                                <dd>
                                  {taxLabels[entry.taxCategory]} ·{" "}
                                  {entry.taxCategoryVerified
                                    ? "증빙 확인"
                                    : "미확정"}
                                </dd>
                              </div>
                              <div>
                                <dt>메모</dt>
                                <dd>{entry.notes || "없음"}</dd>
                              </div>
                            </dl>
                          </details>
                        </article>
                      ))
                  )}
                  {pages > 1 && (
                    <nav
                      className="finance-pagination"
                      aria-label="수입 목록 페이지"
                    >
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        이전
                      </button>
                      <span>
                        {currentPage} / {pages}
                      </span>
                      <button
                        type="button"
                        disabled={currentPage >= pages}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        다음
                      </button>
                    </nav>
                  )}
                </section>
                {editor && (
                  <IncomeForm
                    key={editor.value.id}
                    initial={editor.value}
                    editing={editor.editing}
                    disabled={!writable}
                    onDirty={() => setDirty(true)}
                    onCancel={() =>
                      dirty ? ask({ kind: "discard" }) : setEditor(null)
                    }
                    onSave={(entry) =>
                      ask({
                        kind: "save",
                        entry,
                        expected: editor.expected,
                        editing: editor.editing,
                      })
                    }
                  />
                )}
              </div>
            </>
          )}
        </FinanceWorkspaceShell>
      </div>
      {transferOpen && snapshot && (
        <FinanceTransfer
          snapshot={snapshot}
          onClose={() => setTransferOpen(false)}
          onRestored={(next) => {
            setSnapshot(next);
            setEditor(null);
            setDirty(false);
            setPage(1);
            setError(null);
            setStale(false);
            setNotice("암호화 백업을 복원했습니다.");
          }}
          onUncertain={() => {
            setStale(true);
            setError("복원 상태 확인을 위해 최신 목록을 새로고침해 주세요.");
          }}
        />
      )}
      {confirmation && (
        <FinanceConfirmation
          returnFocus={returnFocus.current}
          title={titles[confirmation.kind]}
          message={messages[confirmation.kind]}
          confirmLabel={
            confirmation.kind === "delete"
              ? "삭제"
              : confirmation.kind === "save"
                ? "로컬 저장"
                : "확인"
          }
          busy={busy}
          destructive={confirmation.kind === "delete"}
          onCancel={() => {
            if (!locked.current) {
              setConfirmation(null);
              setPendingSection(null);
            }
          }}
          onConfirm={() => void confirm()}
        />
      )}
    </div>
  );
}
