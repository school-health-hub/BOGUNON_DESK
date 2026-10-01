import { CloudSun, RefreshCw } from "lucide-react";
import { Panel } from "../components/Panel";
import { executeNativeDesktopAction } from "../desktop/actions";
import { useWeatherData } from "../weather/WeatherDataContext";
import { getWeatherIcon } from "../weather/weatherIcons";
import type { WeatherState } from "../weather/types";

export const WEATHER_SCHOOL_SETTINGS_ACTION_ID = "bogunon-school-settings" as const;
const degrees = (value: number) => `${Math.round(value)}°`;
const actionButton = (label: string, onClick: () => void) => (
  <button className="weather-action" type="button" onClick={onClick}>{label}</button>
);

function WeatherContent({ state, onRefresh }: { readonly state: WeatherState; readonly onRefresh: () => void }) {
  switch (state.status) {
    case "loading": return <p className="weather-state">날씨를 불러오는 중입니다.</p>;
    case "signedOut": return <p className="weather-state">날씨를 보려면 Google 계정을 연결해 주세요.</p>;
    case "connectionRequired": return <div className="weather-state"><p>BOGUNON 연결이 필요합니다.</p>{actionButton("설정 열기", () => void executeNativeDesktopAction("settings"))}</div>;
    case "school-missing": return <div className="weather-state"><p>학교를 등록하면 날씨를 확인할 수 있습니다.</p>{actionButton("BOGUNON에서 학교 등록", () => void executeNativeDesktopAction(WEATHER_SCHOOL_SETTINGS_ACTION_ID))}</div>;
    case "disabled": return <div className="weather-state"><p>BOGUNON에서 날씨 표시가 꺼져 있습니다.</p>{actionButton("설정에서 켜기", () => void executeNativeDesktopAction(WEATHER_SCHOOL_SETTINGS_ACTION_ID))}</div>;
    case "location-unavailable": return <div className="weather-state"><p>학교 위치를 확인하지 못했습니다.</p>{actionButton("학교 정보 확인", () => void executeNativeDesktopAction(WEATHER_SCHOOL_SETTINGS_ACTION_ID))}</div>;
    case "error": return <div className="weather-state"><p>날씨 정보를 불러오지 못했습니다.</p>{actionButton("새로고침", onRefresh)}</div>;
    case "ready": {
      const WeatherIcon = getWeatherIcon(state.weatherCode);
      return (
        <div className="weather-ready">
          <small title={state.schoolName}>{state.schoolName}</small>
          <div className="weather-current"><WeatherIcon aria-hidden="true" /><strong>{degrees(state.temperatureC)}</strong><span>{state.conditionLabel}</span></div>
          <div className="weather-meta"><span>최고 {degrees(state.highC)} · 최저 {degrees(state.lowC)}</span><span>체감 {degrees(state.apparentTemperatureC)}</span></div>
        </div>
      );
    }
  }
}

export function WeatherWidget() {
  const { state, refresh } = useWeatherData();
  return (
    <Panel title="오늘의 날씨" icon={CloudSun} className="weather-panel" action={state.status === "ready"
      ? <button className="weather-refresh" type="button" aria-label="날씨 새로고침" onClick={refresh}><RefreshCw size={14} /></button>
      : undefined}>
      <WeatherContent state={state} onRefresh={refresh} />
    </Panel>
  );
}
