import type { OfficialDocumentReference } from "./referenceTypes";

export type ReferencePackageMetadata = {
  readonly schemaVersion: 1;
  readonly packageId: string;
  readonly packageVersion: string;
  readonly publishedAt: string;
  readonly source: string;
  readonly usageTerms: string;
  readonly redistribution: string;
  readonly review: { readonly reviewer: string; readonly reviewedAt: string };
};

export type ReferencePackageReport = {
  readonly totalRows: number;
  readonly acceptedRows: number;
  readonly excludedRows: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly issues: readonly { readonly row: number; readonly reason: string }[];
};

export type ValidatedReferencePackage = {
  readonly metadata: ReferencePackageMetadata;
  readonly references: readonly OfficialDocumentReference[];
  /** Accepted rows and matching approvals only. Never persist the source JSON. */
  readonly serialized: string;
  readonly contentHash: string;
};

export type ReferencePackageValidation =
  | { readonly status: "valid"; readonly package: ValidatedReferencePackage; readonly report: ReferencePackageReport }
  | { readonly status: "error"; readonly message: string; readonly report: ReferencePackageReport };
