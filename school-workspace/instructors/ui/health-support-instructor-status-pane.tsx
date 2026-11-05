import { Plus } from "lucide-react";

import { Button } from "./Button.js";
import { calculateHealthSupportInstructorManager } from "../core/domain.js";
import type { HealthSupportInstructor } from "../core/validation.js";
import type { HealthSupportSettlementDocuments } from "../core/settlement/documents.js";

function won(value: number): string {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value);
}

export function Dashboard({ calculation, documents, instructor, onOpenWorkLogs }: { readonly calculation: ReturnType<typeof calculateHealthSupportInstructorManager>; readonly documents: HealthSupportSettlementDocuments; readonly instructor: HealthSupportInstructor; readonly onOpenWorkLogs: () => void }) {
  const { settlement } = documents;
  const currentMonthWeekKeys = new Set(calculation.workLogs.filter((log) => log.date.slice(0, 7) === settlement.month).map((log) => log.isoWeek.key));
  const weeklyUsage = calculation.weeklyTotals.filter((total) => currentMonthWeekKeys.has(total.isoWeekKey));
  const recentLogs = [...calculation.workLogs].sort((left, right) => right.date.localeCompare(left.date) || right.startTime.localeCompare(left.startTime)).slice(0, 4);

  return <section aria-label="Dashboard operating overview" className="health-support-dashboard">
    <div className="health-support-dashboard__summary">
      <div><span>{settlement.month} 근무 시간</span><strong>{settlement.hours.toFixed(1)}시간</strong></div>
      <div><span>임금</span><strong>{won(settlement.wages)}</strong></div>
      <div><span>보험료</span><strong>{won(settlement.insurance)}</strong></div>
      <div><span>누적 집행</span><strong>{won(calculation.budget.spent)}</strong></div>
      <div><span>남은 예산</span><strong>{won(calculation.budget.remaining)}</strong></div>
    </div>
    <div className="health-support-dashboard__grid">
      <article><h3>사용 현황</h3><p>월 사용량 {settlement.hours.toFixed(1)}시간 / {instructor.monthlyHourLimit}시간</p>{weeklyUsage.length === 0 ? <p>이번 달 주간 근무기록이 없습니다.</p> : <ul>{weeklyUsage.map((total) => <li key={total.isoWeekKey}><span>{total.isoWeekKey}</span><strong>{total.hours.toFixed(1)}시간 / {instructor.weeklyHourLimit}시간</strong></li>)}</ul>}</article>
      <article><h3>최근 근무기록</h3>{recentLogs.length === 0 ? <><p>이번 달 운영을 시작하려면 첫 근무기록을 추가해 주세요.</p><Button onClick={onOpenWorkLogs}><Plus aria-hidden="true" size={16} />근무 기록 추가</Button></> : <ul>{recentLogs.map((log) => <li key={`${log.date}-${log.startTime}`}><span>{log.date}</span><strong>{log.startTime.slice(0, 5)}–{log.endTime.slice(0, 5)}</strong><em>{log.hours.toFixed(1)}시간</em></li>)}</ul>}</article>
    </div>
  </section>;
}

type SettlementPanelProps = {
  readonly documents: HealthSupportSettlementDocuments;
  readonly onMonthChange: (month: string) => void;
  readonly onPrint: () => void;
  readonly onToggleDetail: () => void;
  readonly printActive: boolean;
  readonly selectedMonth: string;
  readonly showWorkDetail: boolean;
};

export function SettlementPanel({ documents, onMonthChange, onPrint, onToggleDetail, printActive, selectedMonth, showWorkDetail }: SettlementPanelProps) {
  const { settlement } = documents;
  return <section aria-label="Monthly settlement document" className="health-support-dashboard health-support-document health-support-document--work-detail">
    <div className="health-support-settlement__header"><div><span className="health-support-eyebrow">정산</span><h3 aria-label="Selected month settlement">월별 정산</h3><p>선택한 달의 근무시간과 지급액을 확인합니다.</p></div><label>정산 월<input aria-label="Settlement month" onChange={(event) => onMonthChange(event.target.value)} type="month" value={selectedMonth} /></label></div>
    <div className="health-support-settlement__metrics">
      <div><span>근무시간</span><strong>{settlement.hours.toFixed(1)}시간</strong></div>
      <div><span>시간당 단가</span><strong>{won(settlement.hourlyRate)}</strong></div>
      <div><span>인건비</span><strong>{won(settlement.wages)}</strong><small>{settlement.hours.toFixed(1)}시간 × {won(settlement.hourlyRate)}</small></div>
      <div><span>월 보험료</span><strong>{won(settlement.insurance)}</strong></div>
      <div className="is-total"><span>정산 총액</span><strong>{won(settlement.total)}</strong><small>인건비 + 보험료</small></div>
    </div>
    <div className="health-support-settlement__details">
      <article><h3 aria-label="Limit and budget status">예산 현황</h3><div className="health-support-settlement__budget-line"><span>집행</span><strong>{won(documents.budget.spent)} / {won(documents.budget.total)}</strong></div><div className="health-support-settlement__budget-line"><span>잔액</span><strong>{won(documents.budget.remaining)}</strong></div><div aria-hidden="true" className="health-support-settlement__progress"><span style={{ inlineSize: `${documents.budget.total > 0 ? Math.min(100, Math.max(0, documents.budget.spent / documents.budget.total * 100)) : 0}%` }} /></div>{documents.warnings.length === 0 ? <p>현재 예산 범위 내에서 집행 중입니다.</p> : <ul>{documents.warnings.map((warning) => <li key={`${warning.kind}-${"isoWeekKey" in warning ? warning.isoWeekKey : warning.month}`}>{settlementWarningLabel(warning)}</li>)}</ul>}</article>
      <article><h3>근무 한도</h3><p>월 최대 {settlement.hours.toFixed(1)}시간 사용</p>{documents.warnings.length === 0 ? <p>주간·월간 한도 내에서 운영 중입니다.</p> : <ul>{documents.warnings.map((warning) => <li key={`limit-${warning.kind}-${"isoWeekKey" in warning ? warning.isoWeekKey : warning.month}`}>{settlementWarningLabel(warning)}</li>)}</ul>}</article>
    </div>
    <div className="health-support-document__actions health-support-settlement__actions"><Button aria-label="Preview work detail" onClick={onToggleDetail} variant="secondary">근무내역 미리보기</Button><Button aria-label="Print work detail" onClick={onPrint} variant="secondary">근무내역 출력</Button></div>
    {(showWorkDetail || printActive) && <section aria-labelledby="monthly-work-detail-preview-title" className="health-support-document__table"><h3 aria-label="Monthly work-detail preview" id="monthly-work-detail-preview-title">월별 근무내역 미리보기</h3>{documents.monthlyWorkDetail.rows.length === 0 ? <p>선택한 달의 근무기록이 없습니다.</p> : <table aria-label="Monthly work detail"><caption>{selectedMonth} 근무내역</caption><thead><tr><th>일자</th><th>요일</th><th>시작</th><th>종료</th><th>시간</th></tr></thead><tbody>{documents.monthlyWorkDetail.rows.map((row) => <tr key={`${row.date}-${row.startTime}`}><td>{row.date}</td><td>{row.weekday}</td><td>{row.startTime}</td><td>{row.endTime}</td><td>{row.hours.toFixed(1)}</td></tr>)}</tbody><tfoot><tr><th colSpan={4}>합계</th><td>{documents.monthlyWorkDetail.totalHours.toFixed(1)}</td></tr></tfoot></table>}</section>}
  </section>;
}

function settlementWarningLabel(warning: HealthSupportSettlementDocuments["warnings"][number]): string {
  const labels = { monthlyLimit: "월 최대 근무시간을 초과했습니다.", weeklyLimit: "주 최대 근무시간을 초과했습니다.", weeklyWarning: "주간 근무시간을 확인해주세요." } as const;
  return labels[warning.kind];
}
