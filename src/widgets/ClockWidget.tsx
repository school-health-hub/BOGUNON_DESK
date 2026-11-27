import { Clock3 } from "lucide-react";
import { PRODUCT_NAME } from "../branding";
import { useWidgetSession } from "../dashboard/WidgetSessionContext";
import "./clock-widget.css";

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
    <section className="time-card widget-surface" aria-label="현재 날짜와 시간">
      <div className="time-card__content">
        <p className="time-card__label"><Clock3 size={12} aria-hidden="true" />{PRODUCT_NAME}</p>
        <time className="time-card__time" dateTime={now.toISOString()}>{timeFormatter.format(now)}</time>
        <p className="time-card__date">{dateFormatter.format(now)}</p>
      </div>
    </section>
  );
}
