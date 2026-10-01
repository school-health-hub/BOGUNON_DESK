import { CalendarDays, Clock3 } from "lucide-react";
import { PRODUCT_NAME } from "../branding";
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

export function ClockWidget() {
  const { now } = useWidgetSession();

  return (
    <section className="date-card widget-surface" aria-label="현재 날짜와 시간">
      <div className="date-card__eyebrow"><CalendarDays size={15} /> {PRODUCT_NAME}</div>
      <div className="date-card__body">
        <p className="date-card__date">{dateFormatter.format(now)}</p>
        <p className="date-card__time"><Clock3 size={19} /> {timeFormatter.format(now)}</p>
      </div>
    </section>
  );
}
