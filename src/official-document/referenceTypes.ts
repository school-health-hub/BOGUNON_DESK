import type { OfficialDocumentCreateField } from "./types";

export type OfficialDocumentReference = {
  readonly id: string;
  readonly sourceNo: string;
  readonly enabled: boolean;
  readonly purposeLabel: string;
  readonly workAreaLabel: string;
  readonly title: string;
  readonly description: string;
  readonly templateBody: string;
  readonly attachmentExample: string;
  readonly messengerExample: string;
  readonly checklist: string;
  readonly sourceUrl: string;
  readonly documentId: string;
  readonly fileType: string;
  readonly dataKind: string;
  readonly tableCopyText: string;
  readonly tableCopyGuide: string;
  readonly visibility: string;
  readonly deidentified: boolean;
  readonly state: string;
  readonly priority: string;
};

export type OfficialDocumentReferenceLoadResult =
  | { readonly status: "notConnected" }
  | { readonly status: "empty" }
  | { readonly status: "ready"; readonly references: readonly OfficialDocumentReference[] }
  | { readonly status: "error"; readonly message: string };

export interface OfficialDocumentReferenceRepository {
  list(): Promise<OfficialDocumentReferenceLoadResult>;
}

export type OfficialDocumentReferenceDraftSeed = {
  readonly templateBody: string;
  readonly attachmentExample: string;
  readonly messengerExample: string;
  readonly checklist: string;
  readonly tableCopyText: string;
  readonly tableCopyGuide: string;
};

export type OfficialDocumentReferenceApplication = {
  readonly input: import("./types").OfficialDocumentInput;
  readonly changedFields: readonly OfficialDocumentCreateField[];
};
