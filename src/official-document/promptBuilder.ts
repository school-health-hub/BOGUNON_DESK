import { officialDocumentFieldDefinitions } from "./options";
import type { OfficialDocumentInput, OfficialDocumentRevisionInput } from "./types";

const commonRules = [
  "학교 공문서 문체와 번호 체계를 유지할 것",
  "입력하지 않은 사실을 임의로 추가하지 말 것",
  "관련 공문번호, 법령명, 지침명, 기관명, 날짜, 시간, 장소, 금액, 수량, 인원, 대상, 일정, 제출기한, 담당자, 연락처, 붙임, 첨부자료는 사용자가 제공한 값만 사용하고 임의로 생성하지 말 것",
  "불확실한 내용은 추정하지 말고 [확인 필요]로 표시할 것",
  "학생 이름, 학번, 연락처, 건강정보 등 개인 식별 정보를 만들거나 보완하지 말 것",
] as const;

const rulesBlock = (): string => `[작성 원칙]\n${commonRules.map((rule) => `- ${rule}`).join("\n")}`;

export const buildCreatePrompt = (input: OfficialDocumentInput): string => {
  const fieldLines = officialDocumentFieldDefinitions
    .map((field) => [field.label, input[field.name].trim()] as const)
    .filter((entry) => entry[1] !== "")
    .map(([label, value]) => `- ${label}: ${value}`);
  return [
    "다음 정보를 바탕으로 학교 공문 초안을 작성해 주세요.",
    "",
    rulesBlock(),
    "- 제목, 본문, 붙임, 교직원 메신저 문구, 기안 전 체크리스트를 구분해 출력할 것",
    "- 본문은 관련 근거와 1., 2., 가., 나. 번호 체계를 사용할 것",
    "",
    "[입력 정보]",
    `- 문서 목적: ${input.purpose}`,
    `- 업무 분야: ${input.workArea}`,
    ...(fieldLines.length === 0 ? ["- 세부 정보: [입력 필요]"] : fieldLines),
  ].join("\n");
};

export const buildRevisionPrompt = (input: OfficialDocumentRevisionInput): string => [
  "다음 학교 공문을 수정해 주세요.",
  "",
  "[수정 요청]",
  input.request.trim() || "[수정 요청 입력 필요]",
  "",
  rulesBlock(),
  "- 원문의 관련 근거는 수정 요청이 없는 한 유지할 것",
  "- 번호 체계와 붙임 제목은 수정 요청이 없는 한 유지할 것",
  "- 원문에 없는 공문번호, 법령명, 지침명, 기관명, 일정, 금액, 붙임을 새로 만들지 말 것",
  "- 수정 요청이 명시하지 않은 행정 사실은 원문 값을 유지할 것",
  "",
  "[출력]",
  "1. 변경사항 요약",
  "2. 수정된 공문 제목",
  "3. 수정된 공문 본문",
  "4. 붙임 목록",
  "",
  "[원문]",
  input.original.trim() || "[공문 원문 입력 필요]",
].join("\n");

export const buildSummaryPrompt = (original: string): string => [
  "다음 학교 공문에서 실무자가 확인하고 처리해야 할 핵심을 정리해 주세요.",
  "",
  rulesBlock(),
  "- 원문에 명시되지 않은 행정 사실을 추론하거나 만들어내지 말 것",
  "- 필요한 정보가 원문에 없으면 [확인 필요]로 표시할 것",
  "",
  "[출력]",
  "1. 내가 해야 할 일",
  "2. 대상",
  "3. 제출기한",
  "4. 제출방법",
  "5. 제출자료",
  "6. 붙임",
  "7. 담당자 확인사항",
  "",
  "[원문]",
  original.trim() || "[공문 원문 입력 필요]",
].join("\n");
