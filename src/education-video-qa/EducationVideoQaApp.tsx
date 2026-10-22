import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { EducationVideoFinder } from "../education-video/EducationVideoFinder";
import type { SearchDependencies } from "../education-video/searchService";
import "../styles/base.css";
import "../education-video/finder.css";
import "./qa.css";

const QA_IDENTIFIER = "kr.sungandi.schoolhealthdesk.educationvideoqa";
const QA_USER_ID = "00000000-0000-4000-8000-000000000024";

type QaInfo = {
  readonly identifier: string;
  readonly sourceSha: string;
  readonly localData: string;
  readonly integrationsDisabled: boolean;
};

const isQaInfo = (value: unknown): value is QaInfo => {
  if (typeof value !== "object" || value === null) return false;
  return "identifier" in value && value.identifier === QA_IDENTIFIER
    && "sourceSha" in value && typeof value.sourceSha === "string" && /^[a-f0-9]{40}$/.test(value.sourceSha)
    && "localData" in value && typeof value.localData === "string"
    && "integrationsDisabled" in value && value.integrationsDisabled === true;
};

const qaSearchDependencies: SearchDependencies = {
  getSession: async () => ({
    accessToken: "synthetic-finder-qa-token",
    userId: QA_USER_ID,
    expiresAt: Date.now() + 3_600_000,
  }),
  transport: (request, accessToken) => invoke("education_video_qa_search", { request, accessToken }),
};

export function EducationVideoQaApp() {
  const [info, setInfo] = useState<QaInfo | null>(null);
  const [failure, setFailure] = useState("");

  useEffect(() => {
    let active = true;
    void invoke<unknown>("education_video_qa_info")
      .then((value) => {
        if (!active) return;
        if (!isQaInfo(value)) throw new Error("QA isolation mismatch");
        setInfo(value);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFailure(error instanceof Error ? error.message : "QA 실행 실패");
      });
    return () => { active = false; };
  }, []);

  if (failure) return <main className="ev-qa-shell"><section role="alert" className="ev-qa-result ev-qa-result--failed"><h1>QA 격리 확인 실패</h1><p>{failure}</p></section></main>;
  if (!info) return <main className="ev-qa-shell"><p role="status" className="ev-qa-status">격리 identifier와 데이터 경로를 확인하는 중입니다.</p></main>;

  return <div className="ev-qa-shell">
    <aside className="ev-qa-banner" aria-label="QA 격리 상태">
      <strong>합성 데이터 전용 · 운영 연동 차단</strong>
      <span>별도 identifier와 로컬 데이터 경로를 사용합니다. 실제 YouTube·Supabase·사용자 토큰은 사용하지 않습니다.</span>
      <details><summary>격리 정보</summary><p>{info.identifier}</p><p>{info.localData}</p><p>{info.sourceSha}</p></details>
    </aside>
    <EducationVideoFinder
      onClose={() => undefined}
      authStatus="signedIn"
      authIdentity={QA_USER_ID}
      searchDependencies={qaSearchDependencies}
      qaSyntheticMode
    />
  </div>;
}
