import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { OfficialDocumentPanel } from "../components/desktop/OfficialDocumentPanel";
import { OfficialDocumentSessionProvider } from "../official-document/OfficialDocumentSessionContext";
import { ReferencePackageStartup } from "../official-document/ReferencePackageStartup";

const QA_IDENTIFIER = "kr.sungandi.schoolhealthdesk.officialdocumentqa";

type QaInfo = {
  readonly identifier: string;
  readonly sourceSha: string;
  readonly localData: string;
  readonly webviewData: string;
  readonly networkEnabled: boolean;
  readonly loginEnabled: boolean;
  readonly chatGptEnabled: boolean;
  readonly aiEnabled: boolean;
  readonly accountSyncEnabled: boolean;
  readonly updaterEnabled: boolean;
  readonly deepLinkEnabled: boolean;
  readonly autostartEnabled: boolean;
  readonly trayEnabled: boolean;
  readonly externalUrlEnabled: boolean;
};

const booleanBoundaries = [
  "networkEnabled",
  "loginEnabled",
  "chatGptEnabled",
  "aiEnabled",
  "accountSyncEnabled",
  "updaterEnabled",
  "deepLinkEnabled",
  "autostartEnabled",
  "trayEnabled",
  "externalUrlEnabled",
] as const;

const isIsolated = (info: QaInfo): boolean => (
  info.identifier === QA_IDENTIFIER
  && /^[a-f0-9]{40}$/.test(info.sourceSha)
  && /kr\.sungandi\.schoolhealthdesk\.officialdocumentqa[\\/]?$/.test(info.localData)
  && /kr\.sungandi\.schoolhealthdesk\.officialdocumentqa[\\/]main[\\/]official-document-qa-webview[\\/]?$/.test(info.webviewData)
  && booleanBoundaries.every((key) => info[key] === false)
);

export function OfficialDocumentQaApp() {
  const [info, setInfo] = useState<QaInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState("합성 자료만 사용하세요.");

  useEffect(() => {
    let active = true;
    void invoke<QaInfo>("official_document_qa_info").then((next) => {
      if (!active) return;
      if (!isIsolated(next)) {
        setFailed(true);
        return;
      }
      setInfo(next);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, []);

  if (failed) {
    return <main className="official-document-qa-state" role="alert">QA 격리 정보를 확인하지 못했습니다. 창을 닫고 실행을 중지하세요.</main>;
  }
  if (info === null) {
    return <main className="official-document-qa-state" role="status">QA 격리 경계를 확인하는 중입니다.</main>;
  }

  return (
    <main className="official-document-qa-shell">
      <header className="official-document-qa-banner">
        <div>
          <strong>격리 QA · 합성 데이터 전용</strong>
          <span>인증·AI·동기화·업데이트·딥링크·외부 URL 사용 안 함</span>
        </div>
        <details>
          <summary>격리 정보 · {info.sourceSha.slice(0, 7)}</summary>
          <p>{info.identifier}</p>
          <p>{info.localData}</p>
        </details>
        <p role="status">{notice}</p>
      </header>
      <ReferencePackageStartup />
      <OfficialDocumentSessionProvider>
        <OfficialDocumentPanel
          onClose={() => { void getCurrentWindow().close(); }}
          onNotice={setNotice}
          onOpenAiSettings={() => setNotice("격리 QA에서는 외부 AI 연결을 사용할 수 없습니다.")}
          onSendSummaryToQuickAdd={() => setNotice("격리 QA에서는 계정 동기화 기능을 사용할 수 없습니다.")}
        />
      </OfficialDocumentSessionProvider>
    </main>
  );
}
