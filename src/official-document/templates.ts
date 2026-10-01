import type { OfficialDocumentInput } from "./types";
import type { OfficialDocumentWorkArea } from "./options";

export const defaultOfficialDocumentChecklist = [
  "관련 공문 번호와 시행 근거를 확인했습니다.",
  "학년도, 날짜, 요일, 대상 인원을 확인했습니다.",
  "개인정보나 민감정보가 본문에 노출되지 않도록 점검했습니다.",
  "붙임 자료명과 실제 첨부 파일을 대조했습니다.",
  "내부 결재선과 제출처를 학교 상황에 맞게 확인했습니다.",
] as const;

export type OfficialDocumentTemplate = {
  readonly workArea: OfficialDocumentWorkArea;
  readonly label: string;
  readonly aliases: readonly string[];
  readonly purpose: string;
  readonly action: string;
  readonly attachments: readonly string[];
  readonly checklist: readonly string[];
  readonly messengerTitle: string;
  readonly messengerBody: string;
};

type TemplateSeed = {
  readonly workArea: OfficialDocumentWorkArea;
  readonly label?: string;
  readonly aliases?: readonly string[];
  readonly purpose: string;
  readonly action?: string;
  readonly attachments?: readonly string[];
  readonly checklist?: readonly string[];
  readonly messengerBody?: string;
};

const createTemplate = (seed: TemplateSeed): OfficialDocumentTemplate => ({
  workArea: seed.workArea,
  label: seed.label ?? seed.workArea,
  aliases: seed.aliases ?? [],
  purpose: seed.purpose,
  action: seed.action ?? "추진",
  attachments: seed.attachments ?? [],
  checklist: seed.checklist ?? [],
  messengerTitle: `${seed.workArea} 안내`,
  messengerBody: seed.messengerBody
    ?? "선생님, {workName} 관련 안내드립니다.\n대상은 {target}이며 일정은 {dateTime}입니다.\n세부 내용과 붙임 자료를 확인해 주세요.",
});

export const officialDocumentTemplates = [
  createTemplate({ workArea: "학교보건 기본계획", aliases: ["학교보건 및 건강증진 계획"], purpose: "학생 및 교직원의 건강증진과 학교보건 업무의 체계적 운영", attachments: ["학교보건 기본계획"], checklist: ["연간 보건교육과 건강관리 일정이 포함되어 있는지 확인합니다."] }),
  createTemplate({ workArea: "학교보건지원강사", purpose: "학교보건지원강사 운영과 보건실 업무 지원 체계 마련", attachments: ["학교보건지원강사 운영계획", "업무분장표"], checklist: ["근무 시간과 업무 범위를 확인합니다."] }),
  createTemplate({ workArea: "보건실 운영계획", purpose: "보건실 이용 절차와 물품 관리 기준을 정비하여 안전한 보건실 운영", attachments: ["보건실 운영계획"], checklist: ["상비약, 처치 물품, 이용 절차 안내를 확인합니다."] }),
  createTemplate({ workArea: "건강상태 조사 및 응급처치 동의", purpose: "학생 건강상태 파악과 응급상황 대응을 위한 보호자 동의 확인", action: "발송", attachments: ["건강상태 조사 및 응급처치 동의 안내문"], checklist: ["민감정보 수집 항목을 최소화했는지 확인합니다."] }),
  createTemplate({ workArea: "건강검진 시행계획", purpose: "학생 건강검진을 원활하게 실시하기 위한 세부 운영 계획 수립", attachments: ["건강검진 안내 가정통신문", "검진 일정표"], checklist: ["검진기관, 일정, 대상 학년을 확인합니다."] }),
  createTemplate({ workArea: "건강검진 결과보고", purpose: "건강검진 실시 결과와 추후관리 사항 정리", action: "보고", attachments: ["건강검진 결과 현황", "추후관리 안내문"], checklist: ["미검자와 유소견자 추후관리 계획을 확인합니다."] }),
  createTemplate({ workArea: "결핵검사 시행계획", purpose: "학생 결핵검사를 안전하고 원활하게 실시하기 위한 계획 수립", attachments: ["결핵검사 안내문"], checklist: ["촬영 일정, 장소, 동선을 확인합니다."] }),
  createTemplate({ workArea: "감염병 확진 안내문 발송", purpose: "감염병 예방수칙과 등교중지 기준을 보호자에게 안내", action: "발송", attachments: ["감염병 예방 안내 가정통신문"], checklist: ["확진 학생이 특정되지 않도록 표현을 점검합니다."] }),
  createTemplate({ workArea: "보건실 물품 구입", purpose: "보건실 의약품 및 운영 물품 구입을 위한 예산 집행", action: "품의", attachments: ["구입 물품 목록", "견적서"], checklist: ["품목, 수량, 예산 과목을 확인합니다."] }),
  createTemplate({ workArea: "폭력예방교육 실적 보고", purpose: "폭력예방교육 실시 결과와 증빙자료 정리", action: "보고", attachments: ["교육 실시 결과", "참석자 명단"], checklist: ["교육 영역별 이수 실적과 증빙자료를 확인합니다."] }),
] as const satisfies readonly OfficialDocumentTemplate[];

export const fallbackOfficialDocumentTemplate = createTemplate({
  workArea: "기타",
  label: "기타 보건업무",
  purpose: "보건실 관련 업무를 학교 상황에 맞게 정리",
  attachments: ["관련 계획 또는 결과 자료"],
  checklist: ["업무 목적과 처리 근거를 확인합니다."],
});

export const findOfficialDocumentTemplate = (workArea: OfficialDocumentWorkArea): OfficialDocumentTemplate =>
  officialDocumentTemplates.find((template) => template.workArea === workArea || template.aliases.includes(workArea))
  ?? fallbackOfficialDocumentTemplate;

const getTemplateValue = (key: string, input: OfficialDocumentInput): string => {
  switch (key) {
    case "workName": return input.workName;
    case "target": return input.target;
    case "dateTime": return input.dateTime;
    default: return "";
  }
};

export const applyOfficialDocumentTemplate = (template: string, input: OfficialDocumentInput): string =>
  template.replace(/\{(\w+)\}/g, (_match, key: string) => getTemplateValue(key, input).trim() || "[입력 필요]");
