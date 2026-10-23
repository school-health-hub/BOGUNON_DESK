import { describe, expect, it } from "vitest";
import {
  OFFICIAL_DOCUMENT_REFERENCE_HEADERS,
  createDefaultOfficialDocumentReferenceRepository,
  createSyntheticOfficialDocumentReferenceRepository,
  parseOfficialDocumentReferenceRows,
} from "./referenceRepository";

const row = (overrides: Readonly<Record<string, string>> = {}): readonly string[] => {
  const defaults: Readonly<Record<string, string>> = {
    No: "41",
    사용여부: "TRUE",
    문서목적: "계획 기안",
    업무분야: "학교보건 기본계획",
    자료명: "합성 학교보건 계획",
    설명: "개인정보가 없는 합성 참고자료",
    템플릿본문: "1. 관련: [입력 필요]\n2. 다음과 같이 시행하고자 합니다.",
    비식별여부: "TRUE",
  };
  return OFFICIAL_DOCUMENT_REFERENCE_HEADERS.map((header) => overrides[header] ?? defaults[header] ?? "");
};

describe("official document reference repository boundary", () => {
  it("maps all 29 headers by name when columns are reordered", () => {
    const headers = [...OFFICIAL_DOCUMENT_REFERENCE_HEADERS].reverse();
    const values = row({ No: "81", 자료명: "순서 변경 자료" });
    const reordered = headers.map((header) => values[OFFICIAL_DOCUMENT_REFERENCE_HEADERS.indexOf(header)] ?? "");

    const result = parseOfficialDocumentReferenceRows([headers, reordered]);

    expect(result).toMatchObject({ status: "ready" });
    if (result.status !== "ready") throw new Error("ready result expected");
    expect(result.references[0]).toMatchObject({ sourceNo: "81", title: "순서 변경 자료" });
  });

  it.each([
    ["missing", OFFICIAL_DOCUMENT_REFERENCE_HEADERS.slice(1)],
    ["duplicate", [...OFFICIAL_DOCUMENT_REFERENCE_HEADERS, "No"]],
  ])("rejects a %s required header", (_label, headers) => {
    expect(parseOfficialDocumentReferenceRows([headers, row()])).toMatchObject({ status: "error" });
  });

  it("rejects invalid booleans and duplicate reference ids", () => {
    expect(parseOfficialDocumentReferenceRows([
      OFFICIAL_DOCUMENT_REFERENCE_HEADERS,
      row({ 사용여부: "YES" }),
    ])).toMatchObject({ status: "error" });
    expect(parseOfficialDocumentReferenceRows([
      OFFICIAL_DOCUMENT_REFERENCE_HEADERS,
      row({ No: "11" }),
      row({ No: "11" }),
    ])).toMatchObject({ status: "error" });
  });

  it("keeps unsupported classifications, filters disabled rows, and preserves discontinuous source numbers", () => {
    const result = parseOfficialDocumentReferenceRows([
      OFFICIAL_DOCUMENT_REFERENCE_HEADERS,
      row({ No: "3", 문서목적: "협조 요청", 업무분야: "새 업무 분야" }),
      row({ No: "77", 사용여부: "FALSE", 자료명: "숨김 자료" }),
      row({ No: "81", 문서목적: "결과 보고" }),
    ]);

    if (result.status !== "ready") throw new Error("ready result expected");
    expect(result.references.map((reference) => reference.sourceNo)).toEqual(["3", "81"]);
    expect(result.references[0]).toMatchObject({ purposeLabel: "협조 요청", workAreaLabel: "새 업무 분야" });
  });

  it("distinguishes empty and not-connected repository states without network access", async () => {
    expect(parseOfficialDocumentReferenceRows([OFFICIAL_DOCUMENT_REFERENCE_HEADERS])).toEqual({ status: "empty" });
    const repository = createSyntheticOfficialDocumentReferenceRepository({ connected: false });
    await expect(repository.list()).resolves.toEqual({ status: "notConnected" });
    await expect(createDefaultOfficialDocumentReferenceRepository(false).list()).resolves.toEqual({ status: "notConnected" });
  });
});
