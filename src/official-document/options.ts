import type { OfficialDocumentInputField } from "./types";

export const officialDocumentPurposes = [
  "계획 기안",
  "결과 보고",
  "안내문 발송",
  "실적 보고",
  "외부기관 제출",
] as const;
export type OfficialDocumentPurpose = (typeof officialDocumentPurposes)[number];

export const officialDocumentWorkAreas = [
  "학교보건 기본계획",
  "학교보건지원강사",
  "보건실 운영계획",
  "건강상태 조사 및 응급처치 동의",
  "건강검진 시행계획",
  "건강검진 결과보고",
  "건강검진 미검자 추가검진",
  "건강검진 비용 청구",
  "결핵검사 시행계획",
  "결핵검사 결과보고",
  "교직원 결핵검진",
  "결핵검진 이행 점검 결과 제출",
  "소변검사 시행계획",
  "소변검사 결과보고",
  "심폐소생술 교육계획",
  "심폐소생술 결과보고",
  "학생 보건교육 계획",
  "감염병 위기대응 모의훈련",
  "감염병 확진 안내문 발송",
  "호흡기 감염병 예방 수칙 안내",
  "현장체험학습 개인 상비약 안내",
  "보건실 물품 구입",
  "폭력예방교육 실적 보고",
  "아동학대 신고의무자 교육",
  "장애인학대 및 성범죄 신고의무자 교육",
  "기타",
] as const;
export type OfficialDocumentWorkArea = (typeof officialDocumentWorkAreas)[number];

export type OfficialDocumentFieldDefinition = {
  readonly name: OfficialDocumentInputField;
  readonly label: string;
  readonly placeholder: string;
  readonly multiline?: boolean;
};

export const officialDocumentFieldDefinitions = [
  { name: "schoolYear", label: "학년도", placeholder: "예: 2026학년도" },
  { name: "schoolName", label: "학교명", placeholder: "예: ○○고등학교" },
  { name: "relatedDocument", label: "관련 공문", placeholder: "예: 교육지원청 보건교육과-0000(2026. 3. 2.)" },
  { name: "workName", label: "업무명", placeholder: "예: 1학년 건강검진 시행계획" },
  { name: "target", label: "대상", placeholder: "예: 1학년 학생 전체" },
  { name: "dateTime", label: "일시", placeholder: "예: 2026. 6. 18.(목) 09:00~12:00" },
  { name: "place", label: "장소", placeholder: "예: 각 반 교실 및 보건실" },
  { name: "method", label: "방법", placeholder: "예: 검진기관 방문 검진" },
  { name: "organization", label: "기관명", placeholder: "예: ○○검진기관" },
  { name: "peopleCount", label: "인원", placeholder: "예: 학생 180명" },
  { name: "budget", label: "예산", placeholder: "예: 비예산 또는 학교운영비 보건관리" },
  { name: "mainContent", label: "주요 내용", placeholder: "예: 사전 안내, 당일 운영, 결과 확인 및 추후관리", multiline: true },
  { name: "attachments", label: "붙임", placeholder: "예: 안내문, 확인서, 결과 집계표", multiline: true },
  { name: "notes", label: "특이사항", placeholder: "예: 미검자는 추후 별도 안내 예정", multiline: true },
] as const satisfies readonly OfficialDocumentFieldDefinition[];
