import { OFFICIAL_DOCUMENT_REFERENCE_HEADERS as HEADERS } from "./referenceRepository";
import { inspectOfficialDocumentPrivacy } from "./privacyGuard";
import type { ReferencePackageMetadata } from "./referencePackageTypes";

export const MAX_REFERENCE_PACKAGE_BYTES = 5 * 1024 * 1024;
export class ReferencePackageError extends Error {
  constructor(message: string) { super(message); this.name = "ReferencePackageError"; }
}
export type ReferencePackagePayload = ReferencePackageMetadata & {
  readonly review: ReferencePackageMetadata["review"] & { readonly approvedRows: readonly { readonly sourceNo: string; readonly sha256: string }[] };
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
};
export const normalizeReferenceCell = (value: string): string => value.replace(/\r\n?/g, "\n").trim();
const objectValue = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ReferencePackageError("패키지 객체 형식이 올바르지 않습니다.");
  return Object.fromEntries(Object.entries(value));
};
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): void => {
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) throw new ReferencePackageError("패키지 필드가 누락되었거나 지원하지 않는 필드가 있습니다.");
};
const text = (value: unknown, limit = 1000): string => {
  if (typeof value !== "string" || !value.trim() || value.length > limit) throw new ReferencePackageError("필수 메타데이터 또는 문자열 길이가 올바르지 않습니다.");
  return normalizeReferenceCell(value);
};
const date = (value: unknown): string => {
  const result = text(value, 32);
  const timestamp = Date.parse(result);
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(result) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== result.slice(0, 10)) throw new ReferencePackageError("패키지 날짜 형식이 올바르지 않습니다.");
  return result;
};
export const hasReferencePackagePrivacyRisk = (value: string): boolean =>
  !inspectOfficialDocumentPrivacy(value).isSafe
  || /[가-힣A-Za-z0-9]{2,}(?:초등학교|중학교|고등학교|대학교|유치원)/u.test(value)
  || /(?:담당자|교사명|교직원명|학교명)\s*[:：]\s*[가-힣A-Za-z]{2,}/u.test(value)
  || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu.test(value)
  || /(?:[A-Z]:\\|\\\\|\/Users\/|\/home\/)/u.test(value);

export const parseReferencePackagePayload = (input: unknown): ReferencePackagePayload => {
  const value = objectValue(input);
  exactKeys(value, ["schemaVersion", "packageId", "packageVersion", "publishedAt", "source", "usageTerms", "redistribution", "review", "headers", "rows"]);
  if (value.schemaVersion !== 1) throw new ReferencePackageError("지원하지 않는 패키지 스키마 버전입니다.");
  const packageId = text(value.packageId, 100);
  const packageVersion = text(value.packageVersion, 40);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(packageId) || !/^\d+\.\d+\.\d+$/.test(packageVersion)) throw new ReferencePackageError("패키지 ID 또는 버전 형식이 올바르지 않습니다.");
  const review = objectValue(value.review);
  exactKeys(review, ["reviewer", "reviewedAt", "approvedRows"]);
  if (!Array.isArray(review.approvedRows) || review.approvedRows.length > 500) throw new ReferencePackageError("행 승인 목록이 올바르지 않습니다.");
  const approvedRows = review.approvedRows.map((item: unknown) => {
    const approval = objectValue(item);
    exactKeys(approval, ["sourceNo", "sha256"]);
    const sourceNo = text(approval.sourceNo, 100);
    const sha256 = text(approval.sha256, 64).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new ReferencePackageError("행 승인 해시가 올바르지 않습니다.");
    return { sourceNo, sha256 };
  });
  if (new Set(approvedRows.map((item) => item.sourceNo)).size !== approvedRows.length) throw new ReferencePackageError("행 승인 목록에 중복 No가 있습니다.");
  if (!Array.isArray(value.headers) || value.headers.length !== HEADERS.length || !value.headers.every((item: unknown): item is string => typeof item === "string")) throw new ReferencePackageError("29열 header 구조가 올바르지 않습니다.");
  const headers: readonly string[] = value.headers;
  if (new Set(headers).size !== HEADERS.length || HEADERS.some((header) => !headers.includes(header))) throw new ReferencePackageError("29열 header가 누락·중복되었거나 지원하지 않는 열이 있습니다.");
  if (!Array.isArray(value.rows) || value.rows.length > 500) throw new ReferencePackageError("최대 500행만 반입할 수 있습니다.");
  const rows = value.rows.map((item: unknown): readonly string[] => {
    if (!Array.isArray(item) || item.length !== HEADERS.length || !item.every((cell: unknown): cell is string => typeof cell === "string" && cell.length <= 50_000)) throw new ReferencePackageError("행의 셀 형식·개수 또는 50,000자 제한을 확인하세요.");
    return item.map(normalizeReferenceCell);
  });
  const metadata = { schemaVersion: 1, packageId, packageVersion, publishedAt: date(value.publishedAt), source: text(value.source), usageTerms: text(value.usageTerms, 5000), redistribution: text(value.redistribution, 5000), review: { reviewer: text(review.reviewer), reviewedAt: date(review.reviewedAt), approvedRows } } as const;
  if (hasReferencePackagePrivacyRisk([metadata.packageId, metadata.packageVersion, metadata.source, metadata.usageTerms, metadata.redistribution, metadata.review.reviewer].join("\n"))) throw new ReferencePackageError("패키지 메타데이터에 식별정보 의심 항목이 있습니다.");
  return { ...metadata, headers, rows };
};
