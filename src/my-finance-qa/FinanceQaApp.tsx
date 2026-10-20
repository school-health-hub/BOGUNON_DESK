import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { FinanceScreen } from "../my-finance/FinanceScreen";
import "../styles/base.css";
import "./qa.css";
type Info = { identifier: string; sourceSha: string; localData: string; settingsData: string; loginEnabled: boolean; updaterEnabled: boolean; deepLinkEnabled: boolean; autostartEnabled: boolean; trayEnabled: boolean };
export function FinanceQaApp() {
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let active = true; void invoke<Info>("my_finance_qa_info").then((next) => {
    if (!active) return;
    if (next.identifier !== "kr.sungandi.schoolhealthdesk.myfinanceqa" || [next.loginEnabled,next.updaterEnabled,next.deepLinkEnabled,next.autostartEnabled,next.trayEnabled].some(Boolean)) { setFailed(true); return; }
    setInfo(next);
  }).catch(() => { if (active) setFailed(true); }); return () => { active = false; }; }, []);
  return <><aside className="finance-qa-banner"><strong>BOGUNON DESK MY FINANCE QA · 합성 데이터 전용</strong><span>운영 계정 연결·업데이트·시작 프로그램·딥링크·트레이 사용 안 함</span>{info && <details><summary>QA 빌드 및 저장 위치 확인 · {info.sourceSha.slice(0, 7)}</summary><p>{info.identifier}</p><p>로컬: {info.localData}</p><p>설정: {info.settingsData}</p></details>}</aside>{failed ? <main role="alert">QA 격리 정보를 확인하지 못했습니다. 사용을 중지하고 창을 닫아 주세요.</main> : info ? <FinanceScreen qa onClose={() => { void getCurrentWindow().close(); }} /> : <p role="status">QA 격리 정보를 확인하는 중입니다.</p>}</>;
}
