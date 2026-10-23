import { officialDocumentPurposes, officialDocumentWorkAreas, type OfficialDocumentPurpose, type OfficialDocumentWorkArea } from "./options";
import type {
  OfficialDocumentReference,
  OfficialDocumentReferenceApplication,
  OfficialDocumentReferenceDraftSeed,
} from "./referenceTypes";
import type { OfficialDocumentCreateField, OfficialDocumentInput, OfficialDocumentInputField } from "./types";

const purposeAliases: Readonly<Record<string, OfficialDocumentPurpose>> = {
  "감염병 확진 안내문 발송": "안내문 발송",
  "가정통신문 발송": "안내문 발송",
  "품의": "계획 기안",
};

const matchPurpose = (label: string, fallback: OfficialDocumentPurpose): OfficialDocumentPurpose => {
  const exact = officialDocumentPurposes.find((purpose) => purpose === label);
  return exact ?? purposeAliases[label] ?? fallback;
};

const matchWorkArea = (label: string, fallback: OfficialDocumentWorkArea): OfficialDocumentWorkArea =>
  officialDocumentWorkAreas.find((workArea) => workArea === label) ?? fallback;

export const applyOfficialDocumentReference = (
  current: OfficialDocumentInput,
  reference: OfficialDocumentReference,
  touchedFields: readonly OfficialDocumentCreateField[] = [],
): OfficialDocumentReferenceApplication => {
  const values: Readonly<Partial<Record<OfficialDocumentInputField, string>>> = {
    workName: reference.title,
    attachments: reference.attachmentExample,
  };
  const touched = new Set(touchedFields);
  const changedFields: OfficialDocumentCreateField[] = [];
  const next = { ...current };
  for (const [field, value] of Object.entries(values)) {
    if (value === undefined || value.trim() === "" || touched.has(field as OfficialDocumentInputField)) continue;
    if (next[field as OfficialDocumentInputField] === value) continue;
    next[field as OfficialDocumentInputField] = value;
    changedFields.push(field as OfficialDocumentInputField);
  }
  const purpose = touched.has("purpose") ? current.purpose : matchPurpose(reference.purposeLabel, current.purpose);
  const workArea = touched.has("workArea") ? current.workArea : matchWorkArea(reference.workAreaLabel, current.workArea);
  if (purpose !== current.purpose) changedFields.push("purpose");
  if (workArea !== current.workArea) changedFields.push("workArea");
  return {
    input: {
      ...next,
      purpose,
      workArea,
    },
    changedFields,
  };
};

export const createReferenceDraftSeed = (
  reference: OfficialDocumentReference,
): OfficialDocumentReferenceDraftSeed => ({
  templateBody: reference.templateBody,
  attachmentExample: reference.attachmentExample,
  messengerExample: reference.messengerExample,
  checklist: reference.checklist,
  tableCopyText: reference.tableCopyText,
  tableCopyGuide: reference.tableCopyGuide,
});
