import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { AiConnectionProvider } from "../ai/AiConnectionContext";
import { ChatGptConnectionProvider } from "../chatgpt/ChatGptConnectionContext";
import { disconnectedChatGptState } from "../chatgpt/chatgptConnectionService";
import type { ChatGptConnectionService, ChatGptPlanService } from "../chatgpt/types";
import { ToolboxPanel } from "../components/desktop/ToolboxPanel";
import { ConnectedFinder } from "../education-video/ConnectedFinder";
import { OfficialDocumentSessionProvider } from "../official-document/OfficialDocumentSessionContext";
import { createDisabledApiConnection } from "../finder-live-qa/services";

type QaInfo = { identifier: string; sourceSha: string; localData: string; integrationsDisabled: boolean };
const expectedIdentifier = "kr.sungandi.schoolhealthdesk.finderintegrationqa";

const createDisabledConnection = (): ChatGptConnectionService => ({
  getState: () => disconnectedChatGptState,
  subscribe: listener => { listener(disconnectedChatGptState); return () => undefined; },
  refresh: async () => undefined,
  startSignIn: async () => { throw new Error("F-10에서는 OAuth 연결이 비활성화되어 있습니다."); },
  disconnect: async () => undefined,
});
const disabledPlan: ChatGptPlanService = {
  listModels: async () => [],
  generateText: async () => { throw new Error("F-10에서는 외부 AI 요청이 비활성화되어 있습니다."); },
};

export function FinderIntegrationQaApp() {
  const [verified, setVerified] = useState(false);
  const [screen, setScreen] = useState<"toolbox" | "finder" | "placeholder">("toolbox");
  const [notice, setNotice] = useState("격리 상태를 확인하는 중입니다.");
  useEffect(() => {
    void invoke<QaInfo>("finder_integration_qa_info").then(info => {
      if (info.identifier !== expectedIdentifier || !info.integrationsDisabled || !/^[0-9a-f]{40}$/i.test(info.sourceSha)) {
        throw new Error("F-10 격리 계약이 일치하지 않습니다.");
      }
      setVerified(true);
      setNotice(`F-10 격리 확인 · ${info.sourceSha.slice(0, 12)}`);
    }).catch(() => setNotice("F-10 격리 계약을 확인하지 못했습니다."));
  }, []);
  return <ChatGptConnectionProvider createService={createDisabledConnection} planService={disabledPlan} loadSelectedModel={() => null} saveSelectedModel={() => undefined}>
    <AiConnectionProvider createService={createDisabledApiConnection}>
    <OfficialDocumentSessionProvider>
      <aside className="finder-live-qa-banner" aria-label="F-10 격리 실행 환경"><strong>Finder 통합 F-10 · 합성 데이터 전용</strong><p role="status">{notice}</p><p>외부 AI·YouTube·Supabase·OAuth 요청과 운영 AppData 접근은 비활성화되어 있습니다.</p></aside>
      {!verified ? <main aria-busy="true"><p>격리 계약 확인 전에는 도구를 열 수 없습니다.</p></main>
        : screen === "finder" ? <ConnectedFinder onClose={() => setScreen("toolbox")} />
        : screen === "placeholder" ? <main><h1>합성 도구 화면</h1><p>다른 도구 이동 상태를 확인했습니다.</p><button type="button" onClick={() => setScreen("toolbox")}>업무 도구로 돌아가기</button></main>
        : <ToolboxPanel isLoading={false} onClose={() => setNotice("F-10에서는 창 닫기 대신 흐름을 계속 확인합니다.")} onExecute={() => setScreen("placeholder")} onOpenEducationVideo={() => setScreen("finder")} />}
    </OfficialDocumentSessionProvider>
    </AiConnectionProvider>
  </ChatGptConnectionProvider>;
}
