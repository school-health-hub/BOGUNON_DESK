import { officialDocumentPurposes, officialDocumentWorkAreas } from "./options";
import { applyOfficialDocumentTemplate, defaultOfficialDocumentChecklist, findOfficialDocumentTemplate } from "./templates";
import type { OfficialDocumentDraft, OfficialDocumentInput } from "./types";

const purposeEndings = {
  "계획 기안": "시행하고자 합니다.",
  "결과 보고": "결과를 다음과 같이 보고합니다.",
  "안내문 발송": "안내문을 발송하고자 합니다.",
  "실적 보고": "실적을 다음과 같이 보고합니다.",
  "외부기관 제출": "결과를 다음과 같이 제출합니다.",
} as const;

const titleSuffixes = {
  "계획 기안": "시행계획",
  "결과 보고": "결과보고",
  "안내문 발송": "안내문 발송",
  "실적 보고": "실적 보고",
  "외부기관 제출": "결과 제출",
} as const;

const clean = (value: string): string => value.trim();
const valueOrNeed = (value: string): string => clean(value) || "[입력 필요]";

const optionalLine = (label: string, value: string): string | null => {
  const cleaned = clean(value);
  return cleaned === "" ? null : `${label}: ${cleaned}`;
};

const splitAttachments = (value: string): readonly string[] =>
  value.split(/[,;\n]/).map((item) => item.trim()).filter((item) => item !== "");

const formatAttachmentList = (attachments: readonly string[]): string =>
  attachments.length === 0
    ? "붙임\n1. [확인 필요] 1부.\n끝."
    : `붙임\n${attachments.map((item, index) => `${index + 1}. ${item} 1부.`).join("\n")}\n끝.`;

export const createEmptyOfficialDocumentInput = (): OfficialDocumentInput => ({
  purpose: officialDocumentPurposes[0],
  workArea: officialDocumentWorkAreas[0],
  schoolYear: "",
  schoolName: "",
  relatedDocument: "",
  workName: "",
  target: "",
  dateTime: "",
  place: "",
  method: "",
  organization: "",
  peopleCount: "",
  budget: "",
  mainContent: "",
  attachments: "",
  notes: "",
});

const buildTitle = (input: OfficialDocumentInput): string => {
  const template = findOfficialDocumentTemplate(input.workArea);
  const workName = clean(input.workName) || template.label;
  const suffix = titleSuffixes[input.purpose];
  const hasSuffix = workName.includes(suffix) || workName.endsWith("계획") || workName.endsWith("보고");
  return [clean(input.schoolYear), hasSuffix ? workName : `${workName} ${suffix}`].filter((part) => part !== "").join(" ");
};

const buildBody = (input: OfficialDocumentInput): string => {
  const template = findOfficialDocumentTemplate(input.workArea);
  const purpose = clean(input.mainContent) || template.purpose;
  const details = [
    optionalLine("가. 대상", input.target),
    optionalLine("나. 일시", input.dateTime),
    optionalLine("다. 장소", input.place),
    optionalLine("라. 방법", input.method),
    optionalLine("마. 기관명", input.organization),
    optionalLine("바. 인원", input.peopleCount),
    optionalLine("사. 비용 또는 예산", input.budget),
    optionalLine("아. 주요 내용", input.mainContent),
    optionalLine("자. 특이사항", input.notes),
  ].filter((line): line is string => line !== null);
  const attachments = splitAttachments(input.attachments);
  const attachmentText = attachments.length === 0
    ? "[붙임 자료 입력 필요] 1부."
    : attachments.map((item) => `${item} 1부.`).join("\n");
  return [
    `1. 관련: ${valueOrNeed(input.relatedDocument)}`,
    "",
    `2. ${purpose}을(를) 위해 다음과 같이 ${purposeEndings[input.purpose]}`,
    "",
    details.length === 0 ? "가. 세부 내용: [입력 필요]" : details.join("\n"),
    "",
    `붙임  ${attachmentText}  끝.`,
  ].join("\n");
};

export const generateOfficialDocumentDraft = (input: OfficialDocumentInput): OfficialDocumentDraft => {
  const template = findOfficialDocumentTemplate(input.workArea);
  const title = buildTitle(input);
  const attachments = splitAttachments(input.attachments);
  const messenger = applyOfficialDocumentTemplate(template.messengerBody, {
    ...input,
    workName: clean(input.workName) || template.label,
  });
  return {
    title,
    body: buildBody(input),
    attachments: formatAttachmentList(attachments),
    messenger: `제목: ${title} 안내\n\n${messenger}`,
    checklist: [...defaultOfficialDocumentChecklist, ...template.checklist].map((item) => `□ ${item}`).join("\n"),
  };
};

export const composeOfficialDocumentDraft = (draft: OfficialDocumentDraft): string => [
  "공문 제목",
  draft.title,
  "",
  "기안문 본문",
  draft.body,
  "",
  "붙임 목록",
  draft.attachments,
  "",
  "교직원 메신저 안내문",
  draft.messenger,
  "",
  "기안 전 체크리스트",
  draft.checklist,
].join("\n");
