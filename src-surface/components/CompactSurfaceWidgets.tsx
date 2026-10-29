import { CalendarDays, Cloud, CloudRain, FilePenLine, Gauge, LayoutDashboard, NotebookPen, PackageCheck, Snowflake, Sun, type LucideIcon } from "lucide-react";
import type { SurfaceDday, SurfaceLauncher, SurfaceWeather } from "../projection";
import { formatDday } from "../date";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
const timeFormatter = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

export function ClockSurfaceWidget({ now }: Readonly<{ now: Date }>) {
  return <div className="surface-clock">
    <span className="surface-clock__brand"><CalendarDays size={14} /> BOGUNON DESK</span>
    <strong>{timeFormatter.format(now)}</strong>
    <span>{dateFormatter.format(now)}</span>
  </div>;
}

const weatherIcon = (code: SurfaceWeather["iconCode"]): LucideIcon => {
  if (code === "sunny") return Sun;
  if (code === "rain") return CloudRain;
  if (code === "snow") return Snowflake;
  return Cloud;
};

export function WeatherSurfaceWidget({ weather }: Readonly<{ weather: SurfaceWeather }>) {
  if (weather.state === "loading") return <div className="surface-state" role="status"><span className="surface-skeleton" />날씨를 불러오는 중입니다.</div>;
  if (weather.state === "empty") return <p className="surface-empty">표시할 합성 날씨가 없습니다.</p>;
  if (weather.state === "error") return <p className="surface-error" role="alert">날씨 정보를 불러오지 못했습니다.</p>;
  const Icon = weatherIcon(weather.iconCode);
  const updatedAt = weather.updatedAt === null ? null : new Date(weather.updatedAt);
  return <div className="surface-weather">
    <Icon size={30} strokeWidth={1.7} />
    <strong>{weather.temperatureCelsius ?? "—"}°</strong>
    <span>{weather.condition ?? "상태 없음"}</span>
    <small>{updatedAt === null ? "갱신 시각 없음" : `${timeFormatter.format(updatedAt)} 갱신`}</small>
  </div>;
}

export function DdaySurfaceWidget({ items }: Readonly<{ items: readonly SurfaceDday[] }>) {
  if (items.length === 0) return <p className="surface-empty">다가오는 합성 일정이 없습니다.</p>;
  return <ul className="surface-dday-list">{items.map((item) => <li key={item.id}>
    <strong>{formatDday(item.remainingDays)}</strong><span title={item.label}>{item.label}</span>
  </li>)}</ul>;
}

const launcherIcon = (launcher: SurfaceLauncher): LucideIcon => {
  if (launcher.icon === "document") return FilePenLine;
  if (launcher.icon === "purchase") return PackageCheck;
  if (launcher.icon === "record") return NotebookPen;
  return LayoutDashboard;
};

export function LauncherSurfaceWidget({ launchers, onLaunch, disabled = false }: Readonly<{ launchers: readonly SurfaceLauncher[]; onLaunch: (launcher: SurfaceLauncher) => void; disabled?: boolean }>) {
  return <div className="surface-launchers">{launchers.map((launcher) => {
    const Icon = launcherIcon(launcher);
    return <button type="button" key={launcher.actionId} disabled={disabled} onClick={() => onLaunch(launcher)}><span><Icon size={17} /></span><strong>{launcher.label}</strong></button>;
  })}<p><Gauge size={13} /> 실제 앱은 실행하지 않습니다.</p></div>;
}
