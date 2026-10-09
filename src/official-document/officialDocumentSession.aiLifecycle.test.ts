import { describe, expect, it } from "vitest";
import { createOfficialDocumentSession, reduceOfficialDocumentSession } from "./officialDocumentSession";

describe("official document AI session lifecycle", () => {
  it("stores reviewed outbound per mode and invalidates it only after actual input changes", () => {
    const stored = reduceOfficialDocumentSession(createOfficialDocumentSession(), {
      type: "storeReviewedOutbound",
      mode: "revision",
      outboundText: "검토된 전송본",
    });
    const sameValue = reduceOfficialDocumentSession(stored, {
      type: "updateRevision",
      value: stored.revisionInput,
    });
    const changed = reduceOfficialDocumentSession(sameValue, {
      type: "updateRevision",
      value: { original: "새 원문", request: "" },
    });
    expect(stored.outputs.revision.reviewedOutbound).toBe("검토된 전송본");
    expect(stored.outputs.create.reviewedOutbound).toBeNull();
    expect(sameValue).toBe(stored);
    expect(changed.outputs.revision.reviewedOutbound).toBeNull();
  });

  it("invalidates reviewed outbound when a fresh local prompt is built", () => {
    const stored = reduceOfficialDocumentSession(createOfficialDocumentSession(), {
      type: "storeReviewedOutbound",
      mode: "create",
      outboundText: "검토된 전송본",
    });
    const rebuilt = reduceOfficialDocumentSession(stored, {
      type: "setPrompt",
      mode: "create",
      prompt: "새 로컬 프롬프트",
    });
    expect(rebuilt.outputs.create.prompt).toBe("새 로컬 프롬프트");
    expect(rebuilt.outputs.create.reviewedOutbound).toBeNull();
  });

  it("keeps a previous successful result through regeneration failure and cancellation", () => {
    const withResult = reduceOfficialDocumentSession(createOfficialDocumentSession(), {
      type: "setAiResponse",
      mode: "create",
      response: "이전 정상 결과",
    });
    const generating = reduceOfficialDocumentSession(withResult, { type: "beginAiRequest", requestId: 71 });
    const failed = reduceOfficialDocumentSession(generating, { type: "failAiRequest", requestId: 71, error: "일시적 오류" });
    const retrying = reduceOfficialDocumentSession(failed, { type: "beginAiRequest", requestId: 72 });
    const cancelled = reduceOfficialDocumentSession(retrying, { type: "cancelAiRequest", requestId: 72 });
    expect(generating.outputs.create.aiResponse).toBe("이전 정상 결과");
    expect(failed.outputs.create.aiResponse).toBe("이전 정상 결과");
    expect(failed.aiStatus).toBe("error");
    expect(cancelled.outputs.create.aiResponse).toBe("이전 정상 결과");
    expect(cancelled.aiStatus).toBe("idle");
    expect(cancelled.activeAiRequestId).toBeNull();
  });

  it("ignores late success and failure after frontend cancellation", () => {
    const generating = reduceOfficialDocumentSession(createOfficialDocumentSession(), { type: "beginAiRequest", requestId: 81 });
    const cancelled = reduceOfficialDocumentSession(generating, { type: "cancelAiRequest", requestId: 81 });
    const success = reduceOfficialDocumentSession(cancelled, { type: "resolveAiRequest", requestId: 81, mode: "create", response: "늦은 결과" });
    const failure = reduceOfficialDocumentSession(cancelled, { type: "failAiRequest", requestId: 81, error: "늦은 오류" });
    expect(success).toEqual(cancelled);
    expect(failure).toEqual(cancelled);
  });
});
