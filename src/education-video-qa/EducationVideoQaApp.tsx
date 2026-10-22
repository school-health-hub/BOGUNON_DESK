import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "../styles/base.css";
import "../education-video/finder.css";
import "./qa.css";

const QA_IDENTIFIER = "kr.sungandi.schoolhealthdesk.educationvideoqa";

type QaInfo = {
  readonly identifier: string;
  readonly sourceSha: string;
  readonly localData: string;
  readonly integrationsDisabled: boolean;
};

type QaResult = {
  readonly passed: number;
  readonly failed: number;
  readonly checks: readonly string[];
  readonly reportPath: string;
};

type LoadedLibrary = {
  readonly library: { readonly version: number; readonly entries: readonly { readonly videoId: string }[] };
  readonly recovered: boolean;
};

const isQaInfo = (value: unknown): value is QaInfo => {
  if (typeof value !== "object" || value === null) return false;
  return "identifier" in value && value.identifier === QA_IDENTIFIER
    && "sourceSha" in value && typeof value.sourceSha === "string" && /^[a-f0-9]{40}$/.test(value.sourceSha)
    && "localData" in value && typeof value.localData === "string"
    && "integrationsDisabled" in value && value.integrationsDisabled === true;
};

const isLoadedLibrary = (value: unknown): value is LoadedLibrary => {
  if (typeof value !== "object" || value === null || !("library" in value) || !("recovered" in value)) return false;
  const library = value.library;
  return typeof value.recovered === "boolean" && typeof library === "object" && library !== null
    && "version" in library && library.version === 2 && "entries" in library && Array.isArray(library.entries);
};

const searchErrorCode = (value: unknown): string => {
  if (typeof value === "object" && value !== null && "code" in value && typeof value.code === "string") return value.code;
  return "UNKNOWN";
};

const requireCheck = (condition: boolean, name: string, checks: string[]): void => {
  if (!condition) throw new Error(`QA check failed: ${name}`);
  checks.push(name);
};

const runQa = async (): Promise<QaResult> => {
  const checks: string[] = [];
  await invoke("education_video_qa_reset");
  try {
    await invoke("education_video_search", {
      request: { topic: "합성 보건교육", audience: "합성 학생", desiredMinutes: 10 },
      accessToken: "synthetic-finder-qa-token",
    });
    requireCheck(false, "REAL_DISPATCH_DISABLED", checks);
  } catch (error) {
    requireCheck(searchErrorCode(error) === "REAL_DISPATCH_DISABLED", "REAL_DISPATCH_DISABLED", checks);
  }

  const initial = await invoke<unknown>("education_video_library_load");
  requireCheck(isLoadedLibrary(initial) && initial.library.entries.length === 0, "library_load_empty", checks);

  const now = Date.now();
  const entry = {
    videoId: "qaVideo0001",
    teacher: {
      educationTitle: "합성 QA 교육",
      target: "합성 학생",
      schedule: "2026-10-22 1교시",
      instructions: "합성 자료만 사용",
      message: "합성 QA 안내문",
      notes: "실제 학생 정보 없음",
    },
    provider: {
      title: "합성 QA 영상",
      channelId: "synthetic-channel",
      channelTitle: "합성 QA 채널",
      durationSeconds: 600,
      url: "https://www.youtube.com/watch?v=qaVideo0001",
      source: "synthetic-mock",
      official: false,
      officialEvidence: null,
      synthetic: true,
      fetchedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 86_400_000).toISOString(),
    },
  };
  const saved = await invoke<unknown>("education_video_library_save", { entry });
  requireCheck(isLoadedLibrary(saved) && saved.library.entries.length === 1, "library_save", checks);

  const loaded = await invoke<unknown>("education_video_library_load");
  requireCheck(isLoadedLibrary(loaded) && loaded.library.entries[0]?.videoId === entry.videoId, "library_load_saved", checks);

  const exported = await invoke<unknown>("education_video_library_export");
  requireCheck(typeof exported === "string" && exported.includes(entry.videoId), "library_export", checks);

  const imported = await invoke<unknown>("education_video_library_import", {
    json: JSON.stringify({
      version: 2,
      entries: [{
        videoId: "qaVideo0002",
        teacher: { educationTitle: "가져오기 QA", target: "합성 대상", schedule: "", instructions: "", message: "", notes: "" },
        provider: null,
      }],
    }),
  });
  requireCheck(isLoadedLibrary(imported) && imported.library.entries.length === 2, "library_import", checks);

  await invoke("education_video_qa_corrupt_primary");
  const recovered = await invoke<unknown>("education_video_library_recover");
  requireCheck(isLoadedLibrary(recovered) && recovered.recovered && recovered.library.entries.length === 1, "library_recover", checks);

  const result = { passed: checks.length, failed: 0, checks };
  const reportPath = await invoke<string>("education_video_qa_complete", { report: result });
  return { ...result, reportPath };
};

export function EducationVideoQaApp() {
  const [info, setInfo] = useState<QaInfo | null>(null);
  const [result, setResult] = useState<QaResult | null>(null);
  const [failure, setFailure] = useState("");

  useEffect(() => {
    let active = true;
    void invoke<unknown>("education_video_qa_info")
      .then(async (value) => {
        if (!active) return;
        if (!isQaInfo(value)) throw new Error("QA isolation mismatch");
        setInfo(value);
        const next = await runQa();
        if (active) setResult(next);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFailure(error instanceof Error ? error.message : "QA 실행 실패");
      });
    return () => { active = false; };
  }, []);

  return <main className="ev-qa-shell">
    <header className="ev-header">
      <div><span className="ev-eyebrow">BOGUNON DESK · 격리 IPC QA</span><h1>AI 교육영상 Finder</h1><p>합성 데이터로만 네이티브 IPC와 로컬 복구 경로를 검증합니다.</p></div>
      <span className="ev-mock-badge">운영 연동 차단</span>
    </header>
    {failure ? <section role="alert" className="ev-qa-result ev-qa-result--failed"><h2>QA 실패</h2><p>{failure}</p></section> : null}
    {!failure && !result ? <p role="status" className="ev-qa-status">격리 상태와 Finder IPC를 검증하는 중입니다.</p> : null}
    {result ? <section className="ev-qa-result" aria-live="polite"><h2>{result.passed} PASS / {result.failed} FAIL</h2><ul>{result.checks.map((check) => <li key={check}>{check}</li>)}</ul><p>{result.reportPath}</p></section> : null}
    {info ? <details className="ev-qa-details"><summary>격리 경로</summary><p>{info.identifier}</p><p>{info.localData}</p><p>{info.sourceSha}</p></details> : null}
  </main>;
}
