import {
  officialDocumentFieldDefinitions,
  officialDocumentPurposes,
  officialDocumentWorkAreas,
  type OfficialDocumentPurpose,
  type OfficialDocumentWorkArea,
} from "../../official-document/options";
import type {
  OfficialDocumentInput,
  OfficialDocumentInputField,
} from "../../official-document/types";

type OfficialDocumentCreateFormProps = {
  readonly input: OfficialDocumentInput;
  readonly onFieldChange: (field: OfficialDocumentInputField, value: string) => void;
  readonly onPurposeChange: (purpose: OfficialDocumentPurpose) => void;
  readonly onWorkAreaChange: (workArea: OfficialDocumentWorkArea) => void;
};

const createFormSections: readonly {
  readonly id: string;
  readonly title: string;
  readonly fields: readonly OfficialDocumentInputField[];
}[] = [
  {
    id: "basic",
    title: "기본 정보",
    fields: ["schoolYear", "schoolName", "relatedDocument"],
  },
  {
    id: "content",
    title: "공문 내용",
    fields: ["workName", "target", "dateTime", "place", "method", "mainContent"],
  },
  {
    id: "additional",
    title: "추가 정보",
    fields: ["organization", "peopleCount", "budget", "attachments", "notes"],
  },
];

const wideFieldNames: readonly OfficialDocumentInputField[] = [
  "relatedDocument",
  "mainContent",
  "attachments",
  "notes",
];

export function OfficialDocumentCreateForm({
  input,
  onFieldChange,
  onPurposeChange,
  onWorkAreaChange,
}: OfficialDocumentCreateFormProps) {
  return (
    <div className="official-document-form-sections">
      {createFormSections.map((section, sectionIndex) => (
        <section className="official-document-form-section" aria-labelledby={`official-document-${section.id}-heading`} key={section.id}>
          <h3 id={`official-document-${section.id}-heading`}>{section.title}</h3>
          <div className="official-document-form-grid">
            {sectionIndex === 0 && (
              <>
                <label>
                  <span>문서 목적</span>
                  <select
                    aria-label="문서 목적"
                    value={input.purpose}
                    onChange={(event) => onPurposeChange(event.currentTarget.value as OfficialDocumentPurpose)}
                  >
                    {officialDocumentPurposes.map((purpose) => <option key={purpose}>{purpose}</option>)}
                  </select>
                </label>
                <label>
                  <span>업무 분야</span>
                  <select
                    aria-label="업무 분야"
                    value={input.workArea}
                    onChange={(event) => onWorkAreaChange(event.currentTarget.value as OfficialDocumentWorkArea)}
                  >
                    {officialDocumentWorkAreas.map((workArea) => <option key={workArea}>{workArea}</option>)}
                  </select>
                </label>
              </>
            )}
            {section.fields.map((fieldName) => {
              const field = officialDocumentFieldDefinitions.find((candidate) => candidate.name === fieldName);
              if (field === undefined) return null;
              const multiline = "multiline" in field && field.multiline;
              const isWide = wideFieldNames.includes(field.name);
              return (
                <label className={isWide ? "is-wide" : ""} key={field.name}>
                  <span>{field.label}</span>
                  {multiline ? (
                    <textarea
                      aria-label={field.label}
                      rows={field.name === "mainContent" ? 5 : 3}
                      value={input[field.name]}
                      placeholder={field.placeholder}
                      onChange={(event) => onFieldChange(field.name, event.currentTarget.value)}
                    />
                  ) : (
                    <input
                      aria-label={field.label}
                      value={input[field.name]}
                      placeholder={field.placeholder}
                      onChange={(event) => onFieldChange(field.name, event.currentTarget.value)}
                    />
                  )}
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
