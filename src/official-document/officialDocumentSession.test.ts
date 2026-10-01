import { describe, expect, it } from "vitest";
import { buildRevisionPrompt, buildSummaryPrompt } from "./promptBuilder";
import { inspectOfficialDocumentPrivacy } from "./privacyGuard";
import { createOfficialDocumentSession, reduceOfficialDocumentSession } from "./officialDocumentSession";
import { extractOfficialDocumentSummary } from "./summaryExtractor";

describe("official document session reducer", () => {
  it("switches among all three workspace modes", () => {
    const initial = createOfficialDocumentSession();
    const revision = reduceOfficialDocumentSession(initial, { type: "selectMode", mode: "revision" });
    const summary = reduceOfficialDocumentSession(revision, { type: "selectMode", mode: "summary" });
    expect(revision.mode).toBe("revision");
    expect(summary.mode).toBe("summary");
  });

  it("resets document inputs and results without owning the AI connection", () => {
    const populated = reduceOfficialDocumentSession(createOfficialDocumentSession(), {
      type: "updateRevision",
      value: { original: "원문", request: "수정 요청" },
    });
    const withPrompt = reduceOfficialDocumentSession(populated, {
      type: "setPrompt",
      mode: "revision",
      prompt: "생성된 프롬프트",
    });
    expect(reduceOfficialDocumentSession(withPrompt, { type: "reset" })).toEqual(createOfficialDocumentSession());
  });

  it("invalidates stale prompt and AI output when a mode input changes", () => {
    const initial = createOfficialDocumentSession();
    const withPrompt = reduceOfficialDocumentSession(initial, {
      type: "setPrompt",
      mode: "revision",
      prompt: "이전 프롬프트",
    });
    const withResponse = reduceOfficialDocumentSession(withPrompt, {
      type: "setAiResponse",
      mode: "revision",
      response: "이전 작성 결과",
    });
    const changed = reduceOfficialDocumentSession(withResponse, {
      type: "updateRevision",
      value: { original: "새 원문", request: "새 요청" },
    });
    expect(changed.outputs.revision).toEqual({ prompt: "", aiResponse: "" });
  });

  it("imports revision and summary sources into session-only state and prompt builders", () => {
    const revision = reduceOfficialDocumentSession(createOfficialDocumentSession(), {
      type: "importRevisionSource",
      original: "교육청 안내 원문",
      sourceName: "안내.pdf",
    });
    const summary = reduceOfficialDocumentSession(revision, {
      type: "importSummarySource",
      original: "핵심정리 원문",
      sourceName: "요청.hwpx",
    });
    expect(revision.revisionSourceName).toBe("안내.pdf");
    expect(buildRevisionPrompt(revision.revisionInput)).toContain("교육청 안내 원문");
    expect(summary.summarySourceName).toBe("요청.hwpx");
    expect(buildSummaryPrompt(summary.summaryOriginal)).toContain("핵심정리 원문");
  });

  it("applies the existing privacy guard to imported source text before direct AI use", () => {
    const safe = reduceOfficialDocumentSession(createOfficialDocumentSession(), {
      type: "importRevisionSource",
      original: "전 교직원 대상 안전교육 안내",
      sourceName: "안전.pdf",
    });
    const sensitive = reduceOfficialDocumentSession(safe, {
      type: "importRevisionSource",
      original: "학생명: 홍길동\n진단명: 독감",
      sourceName: "민감.hwpx",
    });
    expect(inspectOfficialDocumentPrivacy(safe.revisionInput.original).isSafe).toBe(true);
    expect(inspectOfficialDocumentPrivacy(sensitive.revisionInput.original).isSafe).toBe(false);
  });

  it("clears imported source names and text on reset", () => {
    const imported = reduceOfficialDocumentSession(createOfficialDocumentSession(), {
      type: "importSummarySource",
      original: "원문",
      sourceName: "요청.hwpx",
    });
    expect(reduceOfficialDocumentSession(imported, { type: "reset" })).toEqual(createOfficialDocumentSession());
  });

  it("stores local summary without replacing prompt or AI output", () => {
    const initial = createOfficialDocumentSession();
    const withPrompt = reduceOfficialDocumentSession(initial, {
      type: "setPrompt",
      mode: "summary",
      prompt: "기존 프롬프트",
    });
    const withAi = reduceOfficialDocumentSession(withPrompt, {
      type: "setAiResponse",
      mode: "summary",
      response: "기존 AI 결과",
    });
    const result = extractOfficialDocumentSummary("대상: 관내 학교");
    const summarized = reduceOfficialDocumentSession(withAi, {
      type: "setSummaryLocalResult",
      result,
    });

    expect(summarized.summaryLocalResult).toEqual(result);
    expect(summarized.outputs.summary).toEqual({ prompt: "기존 프롬프트", aiResponse: "기존 AI 결과" });
  });

  it("clears local summary when summary source is edited or imported", () => {
    const summarized = reduceOfficialDocumentSession(createOfficialDocumentSession(), {
      type: "setSummaryLocalResult",
      result: extractOfficialDocumentSummary("대상: 관내 학교"),
    });
    const edited = reduceOfficialDocumentSession(summarized, {
      type: "updateSummary",
      original: "수정한 원문",
    });
    const imported = reduceOfficialDocumentSession(summarized, {
      type: "importSummarySource",
      original: "가져온 원문",
      sourceName: "안내.pdf",
    });

    expect(edited.summaryLocalResult).toBeNull();
    expect(imported.summaryLocalResult).toBeNull();
  });

  it.each(["안내.pdf", "안내.hwpx"])("summarizes imported %s text through the same local path", (sourceName) => {
    const imported = reduceOfficialDocumentSession(createOfficialDocumentSession(), {
      type: "importSummarySource",
      original: "제출대상: 관내 학교\n제출기한: 2026-09-23",
      sourceName,
    });
    const summarized = reduceOfficialDocumentSession(imported, {
      type: "setSummaryLocalResult",
      result: extractOfficialDocumentSummary(imported.summaryOriginal),
    });

    expect(summarized.summaryLocalResult?.target.value).toBe("관내 학교");
    expect(summarized.summaryLocalResult?.deadline.value).toBe("2026-09-23");
  });

  it("clears local summary on reset", () => {
    const summarized = reduceOfficialDocumentSession(createOfficialDocumentSession(), {
      type: "setSummaryLocalResult",
      result: extractOfficialDocumentSummary("대상: 관내 학교"),
    });

    expect(reduceOfficialDocumentSession(summarized, { type: "reset" })).toEqual(createOfficialDocumentSession());
  });

  it("applies a normal AI response only to its active request", () => {
    const generating = reduceOfficialDocumentSession(createOfficialDocumentSession(), {
      type: "beginAiRequest",
      requestId: 1,
    });
    const resolved = reduceOfficialDocumentSession(generating, {
      type: "resolveAiRequest",
      requestId: 1,
      mode: "create",
      response: "현재 응답",
    });

    expect(resolved.outputs.create.aiResponse).toBe("현재 응답");
    expect(resolved.aiStatus).toBe("idle");
  });

  it("ignores an AI response that finishes after reset", () => {
    const generating = reduceOfficialDocumentSession(createOfficialDocumentSession(), {
      type: "beginAiRequest",
      requestId: 1,
    });
    const reset = reduceOfficialDocumentSession(generating, { type: "reset" });
    const stale = reduceOfficialDocumentSession(reset, {
      type: "resolveAiRequest",
      requestId: 1,
      mode: "create",
      response: "이전 응답",
    });
    const staleFailure = reduceOfficialDocumentSession(reset, {
      type: "failAiRequest",
      requestId: 1,
      error: "이전 오류",
    });

    expect(stale).toEqual(reset);
    expect(staleFailure).toEqual(reset);
  });

  it("ignores an AI response after another document is imported", () => {
    const generating = reduceOfficialDocumentSession(createOfficialDocumentSession(), {
      type: "beginAiRequest",
      requestId: 1,
    });
    const imported = reduceOfficialDocumentSession(generating, {
      type: "importRevisionSource",
      original: "새 공문",
      sourceName: "새문서.pdf",
    });
    const stale = reduceOfficialDocumentSession(imported, {
      type: "resolveAiRequest",
      requestId: 1,
      mode: "revision",
      response: "이전 응답",
    });

    expect(stale).toEqual(imported);
  });

  it("ignores an AI response after the workspace mode changes", () => {
    const generating = reduceOfficialDocumentSession(createOfficialDocumentSession(), {
      type: "beginAiRequest",
      requestId: 1,
    });
    const changedMode = reduceOfficialDocumentSession(generating, {
      type: "selectMode",
      mode: "summary",
    });
    const stale = reduceOfficialDocumentSession(changedMode, {
      type: "resolveAiRequest",
      requestId: 1,
      mode: "create",
      response: "이전 응답",
    });

    expect(stale).toEqual(changedMode);
  });

  it("allows only the latest consecutive AI request to update the session", () => {
    const first = reduceOfficialDocumentSession(createOfficialDocumentSession(), {
      type: "beginAiRequest",
      requestId: 1,
    });
    const second = reduceOfficialDocumentSession(first, {
      type: "beginAiRequest",
      requestId: 2,
    });
    const stale = reduceOfficialDocumentSession(second, {
      type: "resolveAiRequest",
      requestId: 1,
      mode: "create",
      response: "첫 응답",
    });
    const current = reduceOfficialDocumentSession(stale, {
      type: "resolveAiRequest",
      requestId: 2,
      mode: "create",
      response: "두 번째 응답",
    });

    expect(stale).toEqual(second);
    expect(current.outputs.create.aiResponse).toBe("두 번째 응답");
  });
});
