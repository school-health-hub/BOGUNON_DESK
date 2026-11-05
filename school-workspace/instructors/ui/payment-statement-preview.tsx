"use client";




import type { HealthSupportSettlementDocuments } from "../core/settlement/documents.js";

type PaymentStatementPreviewProps = {
  readonly documents: HealthSupportSettlementDocuments;
  readonly printActive: boolean;
  readonly showPreview: boolean;
};

export function PaymentStatementPreview({ documents, printActive, showPreview }: PaymentStatementPreviewProps) {
  const statement = documents.paymentStatement;
  if (!showPreview && !printActive) return null;


  return <section aria-labelledby="payment-statement-preview-title" className="payment-statement-preview">

    <h2 id="payment-statement-preview-title">지급명세서</h2>
    <div className="payment-statement-preview__meta"><span>성명: {statement.instructorName}</span><span>주당시수: {statement.weeklyHours}시간</span><span>과목: {statement.subject}</span><span>조회월: {statement.month}</span></div>
    {statement.rows.length === 0 ? <p role="status">해당 월의 근무기록이 없습니다.</p> : <>
      <table aria-label="Payment statement detail"><thead><tr><th>일자</th><th>요일</th><th>수업시수</th><th>비고</th></tr></thead><tbody>{statement.rows.map((row, index) => <tr key={`${row.date}-${row.isoWeekKey}-${index}`}><td>{Number(statement.month.slice(5, 7))}월 {Number(row.date.slice(8, 10))}일</td><td>{row.weekday}</td><td>{row.hours}</td><td>{row.note}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>총계</th><td>{statement.hours}</td><td>{statement.weeklyTotals.map((total) => `${total.isoWeekKey.replace(/^\d{4}-W/, "")}주차 ${total.hours}시간`).join(" · ")}</td></tr><tr><th colSpan={2}>금액</th><td colSpan={2}>{statement.amount.toLocaleString("ko-KR")}원</td></tr></tfoot></table>
      <div className="payment-statement-preview__weekly" aria-label="Weekly payment statement totals">{statement.weeklyTotals.map((total) => <span key={total.isoWeekKey}>{total.isoWeekKey.replace(/^\d{4}-W/, "")}주차 {total.hours}시간</span>)}</div>
    </>}
  </section>;
}
