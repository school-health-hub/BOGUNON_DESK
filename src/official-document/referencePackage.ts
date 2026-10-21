import { OFFICIAL_DOCUMENT_REFERENCE_HEADERS as HEADERS, parseOfficialDocumentReferenceRows } from "./referenceRepository";
import { MAX_REFERENCE_PACKAGE_BYTES, ReferencePackageError, hasReferencePackagePrivacyRisk, normalizeReferenceCell, parseReferencePackagePayload } from "./referencePackageSchema";
import type { ReferencePackageMetadata, ReferencePackageReport, ReferencePackageValidation } from "./referencePackageTypes";

export { MAX_REFERENCE_PACKAGE_BYTES } from "./referencePackageSchema";
export type { ReferencePackageMetadata, ReferencePackageReport, ReferencePackageValidation, ValidatedReferencePackage } from "./referencePackageTypes";

const sha256 = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (part) => part.toString(16).padStart(2, "0")).join("");
};

export const hashReferencePackageRow = async (headers: readonly string[], row: readonly string[]): Promise<string> =>
  sha256(JSON.stringify(HEADERS.map((header) => normalizeReferenceCell(row[headers.indexOf(header)] ?? ""))));

const errorResult = (message: string): ReferencePackageValidation => ({
  status: "error", message,
  report: { totalRows: 0, acceptedRows: 0, excludedRows: 0, errorCount: 1, warningCount: 0, issues: [{ row: 0, reason: message }] },
});

export const validateReferencePackage = async (text: string): Promise<ReferencePackageValidation> => {
  if (new TextEncoder().encode(text).byteLength > MAX_REFERENCE_PACKAGE_BYTES) return errorResult("JSON 패키지는 최대 5MiB까지 반입할 수 있습니다.");
  try {
    const input: unknown = JSON.parse(text);
    const payload = parseReferencePackagePayload(input);
    const canonicalRows = payload.rows.map((row) => HEADERS.map((header) => row[payload.headers.indexOf(header)]));
    const noIndex = HEADERS.indexOf("No");
    const enabledIndex = HEADERS.indexOf("사용여부");
    const deidentifiedIndex = HEADERS.indexOf("비식별여부");
    const ids = new Set<string>();
    const issues: { row: number; reason: string }[] = [];
    const accepted: string[][] = [];
    const approvals: { sourceNo: string; sha256: string }[] = [];
    const fingerprints = new Set<string>();
    for (const [index, row] of canonicalRows.entries()) {
      if (row.every((cell) => cell === "")) { issues.push({ row: index + 1, reason: "빈 행 제외" }); continue; }
      const sourceNo = row[noIndex];
      if (!sourceNo || !row[HEADERS.indexOf("자료명")]) throw new ReferencePackageError("행의 No 또는 자료명이 누락되었습니다.");
      if (ids.has(sourceNo)) throw new ReferencePackageError("중복 No가 있어 패키지를 반입하지 않았습니다.");
      ids.add(sourceNo);
      if (!["TRUE", "FALSE"].includes(row[enabledIndex]) || !["TRUE", "FALSE"].includes(row[deidentifiedIndex])) throw new ReferencePackageError("사용여부·비식별여부는 TRUE 또는 FALSE여야 합니다.");
      const approval = payload.review.approvedRows.find((item) => item.sourceNo === sourceNo);
      let reason: string | null = null;
      if (row[enabledIndex] !== "TRUE") reason = "사용 중지 자료 제외";
      else if (row[deidentifiedIndex] !== "TRUE") reason = "비식별 확인되지 않은 자료 제외";
      else if (!approval) reason = "승인 목록에 없는 자료 제외";
      else if (await hashReferencePackageRow(HEADERS, row) !== approval.sha256) reason = "승인 후 내용이 변경된 자료 제외";
      else if (hasReferencePackagePrivacyRisk(row.join("\n"))) reason = "개인정보 또는 학교 식별정보 의심 자료 제외";
      if (reason !== null) { issues.push({ row: index + 1, reason }); continue; }
      const fingerprint = JSON.stringify(row.filter((_cell, column) => column !== noIndex));
      if (fingerprints.has(fingerprint)) issues.push({ row: index + 1, reason: "다른 No의 동일 내용 자료: 중복 검토 필요" });
      fingerprints.add(fingerprint);
      accepted.push(row);
      if (approval) approvals.push(approval);
    }
    if (payload.review.approvedRows.some((item) => !ids.has(item.sourceNo))) throw new ReferencePackageError("존재하지 않는 No가 행 승인 목록에 있습니다.");
    const parsed = parseOfficialDocumentReferenceRows([HEADERS, ...accepted]);
    if (parsed.status === "error") throw new ReferencePackageError("참고자료 행을 해석하지 못했습니다.");
    const metadata: ReferencePackageMetadata = {
      schemaVersion: 1, packageId: payload.packageId, packageVersion: payload.packageVersion,
      publishedAt: payload.publishedAt, source: payload.source, usageTerms: payload.usageTerms,
      redistribution: payload.redistribution, review: { reviewer: payload.review.reviewer, reviewedAt: payload.review.reviewedAt },
    };
    const serialized = JSON.stringify({ ...metadata, review: { ...metadata.review, approvedRows: approvals }, headers: HEADERS, rows: accepted });
    const report: ReferencePackageReport = { totalRows: payload.rows.length, acceptedRows: accepted.length, excludedRows: payload.rows.length - accepted.length, errorCount: 0, warningCount: issues.length, issues };
    return { status: "valid", package: { metadata, references: parsed.status === "ready" ? parsed.references : [], serialized, contentHash: await sha256(serialized) }, report };
  } catch (error: unknown) {
    if (error instanceof ReferencePackageError) return errorResult(error.message);
    if (error instanceof SyntaxError) return errorResult("올바른 JSON 패키지가 아닙니다.");
    return errorResult("패키지 검증을 완료하지 못했습니다. 기존 자료는 유지됩니다.");
  }
};
