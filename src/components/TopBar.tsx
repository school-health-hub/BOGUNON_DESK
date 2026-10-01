import { CalendarDays, Clock3, Sparkles } from "lucide-react";
import { PRODUCT_NAME } from "../branding";
import { formatRemainingUntil } from "../dashboard/dateSource";
import { useWidgetSession } from "../dashboard/WidgetSessionContext";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function TopBar() {
  const { now } = useWidgetSession();

  return (
    <header className="top-grid">
      <section className="date-card" aria-label="현재 날짜와 시간">
        <div className="date-card__eyebrow"><CalendarDays size={15} /> {PRODUCT_NAME}</div>
        <div className="date-card__body">
          <p className="date-card__date">{dateFormatter.format(now)}</p>
          <p className="date-card__time"><Clock3 size={19} /> {timeFormatter.format(now)}</p>
        </div>
      </section>

      <section className="summary-card" aria-labelledby="today-summary-title">
        <div className="summary-card__heading">
          <Sparkles size={17} />
          <h1 id="today-summary-title">오늘의 보건실</h1>
        </div>
        <div className="summary-stats">
          <div><strong>3</strong><span>오늘 일정</span></div>
          <div><strong>6</strong><span>오늘 업무</span></div>
          <div><strong className="summary-stats__urgent">2</strong><span>미완료</span></div>
          <div><strong>1</strong><span>D-Day</span></div>
        </div>
      </section>

      <section className="priority-card" aria-labelledby="priority-title">
        <div className="priority-card__label"><span aria-hidden="true" /> 지금 해야 할 일</div>
        <h2 id="priority-title">마약류 예방교육 결과보고 제출</h2>
        <div className="priority-card__meta"><span>오늘 16:00까지</span><strong>{formatRemainingUntil(now, 16)}</strong></div>
      </section>
    </header>
  );
}
