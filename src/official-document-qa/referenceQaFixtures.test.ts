import { describe, expect, it } from "vitest";
import hashMismatch from "../../qa/official-document/fixtures/reference-hash-mismatch.json";
import privacyExcluded from "../../qa/official-document/fixtures/reference-privacy-excluded.json";
import valid from "../../qa/official-document/fixtures/reference-valid.json";
import { validateReferencePackage } from "../official-document/referencePackage";

describe("official-document QA fixtures", () => {
  it("accepts only the enabled approved row in the valid fixture", async () => {
    expect(await validateReferencePackage(JSON.stringify(valid))).toMatchObject({
      status: "valid",
      report: { totalRows: 2, acceptedRows: 1, excludedRows: 1 },
    });
  });

  it("excludes a row whose approval hash does not match", async () => {
    expect(await validateReferencePackage(JSON.stringify(hashMismatch))).toMatchObject({
      status: "valid",
      report: { totalRows: 1, acceptedRows: 0, excludedRows: 1 },
    });
  });

  it("excludes the non-deidentified privacy row without rejecting the safe row", async () => {
    const result = await validateReferencePackage(JSON.stringify(privacyExcluded));
    expect(result).toMatchObject({
      status: "valid",
      report: { totalRows: 2, acceptedRows: 1, excludedRows: 1 },
    });
    if (result.status === "valid") expect(result.package.serialized).not.toContain("홍길동");
  });
});
