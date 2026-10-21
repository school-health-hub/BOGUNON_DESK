import { describe, expect, it } from "vitest";
import { OFFICIAL_DOCUMENT_REFERENCE_HEADERS as headers } from "./referenceRepository";
import { hashReferencePackageRow, validateReferencePackage } from "./referencePackage";

const row = (values: Readonly<Record<string, string>> = {}): string[] => {
  const fields: Readonly<Record<string, string>> = {
  No: "1", 사용여부: "TRUE", 비식별여부: "TRUE", 자료명: "합성 계획 자료", 템플릿본문: "1. 관련: [입력 필요]",
  ...values,
  };
  return headers.map((header) => fields[header] ?? "");
};

const fixture = async (rows: readonly string[][] = [row()]) => ({
  schemaVersion: 1, packageId: "synthetic-reference", packageVersion: "1.0.0", publishedAt: "2026-10-22",
  source: "합성 제작 자료", usageTerms: "로컬 검증 전용", redistribution: "재배포 제한",
  review: { reviewer: "합성 검토자", reviewedAt: "2026-10-22", approvedRows: await Promise.all(rows.map(async (values) => ({ sourceNo: values[0], sha256: await hashReferencePackageRow(headers, values) }))) },
  headers, rows,
});

describe("local reference package boundary", () => {
  it("accepts a reviewed synthetic package and preserves canonical revalidation", async () => {
    const result = await validateReferencePackage(JSON.stringify(await fixture()));
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.package.references).toHaveLength(1);
    expect(result.report.acceptedRows).toBe(1);
    expect(await validateReferencePackage(result.package.serialized)).toMatchObject({ status: "valid", package: { contentHash: result.package.contentHash } });
  });

  const excludedRows: readonly Readonly<Record<string, string>>[] = [
    { 사용여부: "FALSE" }, { 비식별여부: "FALSE" }, { 설명: "합성초등학교 안내" },
    { 설명: "학생명: 홍길동" }, { 설명: "연락처 010-1234-5678" },
  ];
  it.each(excludedRows)("excludes unsafe or disabled rows without retaining their text: %o", async (values) => {
    const result = await validateReferencePackage(JSON.stringify(await fixture([row(), row({ No: "2", ...values })])));
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    expect(result.report.excludedRows).toBe(1);
    expect(result.package.references).toHaveLength(1);
    expect(result.package.serialized).not.toContain("홍길동");
    expect(result.package.serialized).not.toContain("010-1234-5678");
    expect(result.package.serialized).not.toContain("합성초등학교");
  });

  it("excludes unapproved and altered rows", async () => {
    const data = await fixture([row(), row({ No: "2" }), row({ No: "3" })]);
    data.review.approvedRows.pop();
    data.rows[1][4] = "수정된 자료";
    const result = await validateReferencePackage(JSON.stringify(data));
    expect(result).toMatchObject({ status: "valid", report: { acceptedRows: 1, excludedRows: 2 } });
  });

  it("rejects duplicate source numbers without replacing anything", async () => {
    expect(await validateReferencePackage(JSON.stringify(await fixture([row(), row()])))).toMatchObject({ status: "error" });
  });

  it.each(["missing", "duplicate", "unknown"])("rejects %s headers", async (kind) => {
    const data = await fixture();
    const changed = kind === "missing" ? headers.slice(1) : kind === "duplicate" ? [...headers.slice(1), headers[1]] : [...headers.slice(1), "외부열"];
    expect(await validateReferencePackage(JSON.stringify({ ...data, headers: changed }))).toMatchObject({ status: "error" });
  });

  it("rejects malformed JSON, booleans, oversized cells and more than 500 rows", async () => {
    expect(await validateReferencePackage("not json")).toMatchObject({ status: "error" });
    for (const badRow of [row({ 사용여부: "YES" }), row({ 설명: "x".repeat(50_001) })]) {
      expect(await validateReferencePackage(JSON.stringify(await fixture([badRow])))).toMatchObject({ status: "error" });
    }
    const data = await fixture();
    expect(await validateReferencePackage(JSON.stringify({ ...data, rows: Array.from({ length: 501 }, () => row()) }))).toMatchObject({ status: "error" });
    expect(await validateReferencePackage(" ".repeat(5 * 1024 * 1024 + 1))).toMatchObject({ status: "error" });
  });

  it("hashes reordered headers and normalized line endings identically", async () => {
    const values = row({ 템플릿본문: " a\r\nb\tc " });
    const reordered = [...headers].reverse();
    expect(await hashReferencePackageRow(reordered, [...values].reverse())).toBe(await hashReferencePackageRow(headers, row({ 템플릿본문: "a\nb\tc" })));
  });

  it.each(["2026-02-31", "2026-13-01", "2026-02-29", "2026-01-01T25:00:00Z"])("rejects impossible publication date %s", async (publishedAt) => {
    expect(await validateReferencePackage(JSON.stringify({ ...await fixture(), publishedAt }))).toMatchObject({ status: "error", report: { errorCount: 1 } });
  });

  it("rejects sensitive metadata without echoing it", async () => {
    const result = await validateReferencePackage(JSON.stringify({ ...await fixture(), source: "owner@example.com" }));
    expect(result.status).toBe("error");
    expect(JSON.stringify(result)).not.toContain("owner@example.com");
  });
});
