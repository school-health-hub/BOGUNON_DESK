import { createEmptyOfficialDocumentInput } from "./documentGenerator";
import type { OfficialDocumentReferenceDraftSeed } from "./referenceTypes";
import type { OfficialDocumentInput, OfficialDocumentRevisionInput } from "./types";

export type OfficialDocumentDraftQualityScenario = {
  readonly id: string;
  readonly label: string;
  readonly input: OfficialDocumentInput;
  readonly expectedTitleText: string;
  readonly expectedBodyText: readonly string[];
  readonly expectedAttachments: readonly string[];
};

const baseInput = createEmptyOfficialDocumentInput();

export const officialDocumentDraftQualityScenarios = [
  {
    id: "general-plan",
    label: "일반 계획 기안",
    input: {
      ...baseInput,
      purpose: "계획 기안",
      workArea: "학교보건 기본계획",
      schoolYear: "2030학년도",
      relatedDocument: "합성근거-TEST-001",
      workName: "합성 보건업무 운영 계획",
      target: "합성 대상 전체",
      peopleCount: "합성 인원 120명",
      budget: "합성 예산 300,000원",
      mainContent: "합성 보건업무 운영 절차 수립",
      attachments: "합성 운영계획서",
    },
    expectedTitleText: "2030학년도 합성 보건업무 운영 계획",
    expectedBodyText: ["1. 관련: 합성근거-TEST-001", "2. 합성 보건업무 운영 절차 수립", "가. 대상: 합성 대상 전체", "바. 인원: 합성 인원 120명", "사. 비용 또는 예산: 합성 예산 300,000원"],
    expectedAttachments: ["합성 운영계획서"],
  },
  {
    id: "student-notice",
    label: "학생 대상 안내 공문",
    input: {
      ...baseInput,
      purpose: "안내문 발송",
      workArea: "건강상태 조사 및 응급처치 동의",
      workName: "합성 건강상태 조사",
      target: "합성 학년 학생 및 보호자",
      mainContent: "건강상태 조사 절차 안내",
      attachments: "합성 가정통신문",
    },
    expectedTitleText: "합성 건강상태 조사 안내문 발송",
    expectedBodyText: ["2. 건강상태 조사 절차 안내", "가. 대상: 합성 학년 학생 및 보호자"],
    expectedAttachments: ["합성 가정통신문"],
  },
  {
    id: "staff-cooperation",
    label: "교직원 협조 요청",
    input: {
      ...baseInput,
      purpose: "계획 기안",
      workArea: "보건실 운영계획",
      workName: "합성 보건실 운영 협조",
      target: "합성 교직원",
      method: "업무별 확인 후 협조",
      mainContent: "보건실 운영 협조사항 안내",
      notes: "합성 자료만 사용",
    },
    expectedTitleText: "합성 보건실 운영 협조 시행계획",
    expectedBodyText: ["보건실 운영 협조사항 안내", "가. 대상: 합성 교직원", "라. 방법: 업무별 확인 후 협조", "자. 특이사항: 합성 자료만 사용"],
    expectedAttachments: ["[확인 필요]"],
  },
  {
    id: "screening-plan",
    label: "검진·검사 운영 계획",
    input: {
      ...baseInput,
      purpose: "계획 기안",
      workArea: "건강검진 시행계획",
      workName: "합성 건강검진 운영 계획",
      dateTime: "2030. 6. 18.(화) 09:00~12:00",
      place: "합성 검사 공간",
      organization: "합성 검진기관",
      mainContent: "검진 대상과 동선 및 사후 절차 안내",
      attachments: "합성 검진 안내문, 합성 일정표",
    },
    expectedTitleText: "합성 건강검진 운영 계획",
    expectedBodyText: ["검진 대상과 동선 및 사후 절차 안내", "나. 일시: 2030. 6. 18.(화) 09:00~12:00", "다. 장소: 합성 검사 공간", "마. 기관명: 합성 검진기관"],
    expectedAttachments: ["합성 검진 안내문", "합성 일정표"],
  },
  {
    id: "multiple-attachments",
    label: "여러 개의 붙임이 있는 공문",
    input: {
      ...baseInput,
      purpose: "결과 보고",
      workArea: "건강검진 결과보고",
      workName: "합성 검진 결과",
      mainContent: "합성 검진 결과와 후속 조치 보고",
      attachments: "합성 결과표; 합성 확인서\n합성 후속계획",
    },
    expectedTitleText: "합성 검진 결과보고",
    expectedBodyText: ["2. 합성 검진 결과와 후속 조치 보고"],
    expectedAttachments: ["합성 결과표", "합성 확인서", "합성 후속계획"],
  },
  {
    id: "pre-numbered-body",
    label: "본문 번호가 이미 입력된 공문",
    input: {
      ...baseInput,
      purpose: "계획 기안",
      workArea: "기타",
      workName: "합성 번호 검증 계획",
      mainContent: "1. 사전 준비\n2. 당일 운영",
      attachments: "합성 점검표",
    },
    expectedTitleText: "합성 번호 검증 계획",
    expectedBodyText: ["1. 사전 준비", "2. 당일 운영"],
    expectedAttachments: ["합성 점검표"],
  },
  {
    id: "long-multiline-korean",
    label: "긴 한국어 문장과 여러 줄 본문",
    input: {
      ...baseInput,
      purpose: "계획 기안",
      workArea: "학생 보건교육 계획",
      workName: "합성 보건교육 계획",
      mainContent: "첫째 줄은 합성 교육의 목적과 진행 절차를 충분히 설명하는 긴 한국어 문장입니다.\n둘째 줄은 줄바꿈 이후에도 사용자가 입력한 문장 순서와 특수문자가 유지되는지 확인합니다.",
      notes: "문단 순서 유지",
    },
    expectedTitleText: "합성 보건교육 계획",
    expectedBodyText: [
      "첫째 줄은 합성 교육의 목적과 진행 절차를 충분히 설명하는 긴 한국어 문장입니다.",
      "둘째 줄은 줄바꿈 이후에도 사용자가 입력한 문장 순서와 특수문자가 유지되는지 확인합니다.",
      "자. 특이사항: 문단 순서 유지",
    ],
    expectedAttachments: ["[확인 필요]"],
  },
  {
    id: "empty-optional-fields",
    label: "빈 선택 필드가 있는 공문",
    input: {
      ...baseInput,
      purpose: "실적 보고",
      workArea: "폭력예방교육 실적 보고",
      workName: "합성 교육 실적",
    },
    expectedTitleText: "합성 교육 실적 보고",
    expectedBodyText: ["1. 관련: [입력 필요]", "가. 세부 내용: [입력 필요]"],
    expectedAttachments: ["[확인 필요]"],
  },
  {
    id: "symbols-parentheses-date",
    label: "특수문자·괄호·날짜를 포함한 공문",
    input: {
      ...baseInput,
      purpose: "외부기관 제출",
      workArea: "결핵검진 이행 점검 결과 제출",
      workName: "합성 점검 결과(2차)",
      dateTime: "2030. 10. 23.(수) 14:00~15:30",
      mainContent: "점검 결과(A/B) 및 보완사항 100% 확인",
      attachments: "합성 결과표(최종), 합성 체크리스트[A]",
    },
    expectedTitleText: "합성 점검 결과(2차) 결과 제출",
    expectedBodyText: ["점검 결과(A/B) 및 보완사항 100% 확인", "2030. 10. 23.(수) 14:00~15:30"],
    expectedAttachments: ["합성 결과표(최종)", "합성 체크리스트[A]"],
  },
] as const satisfies readonly OfficialDocumentDraftQualityScenario[];

export const officialDocumentRevisionSummaryQualityFixture: {
  readonly label: string;
  readonly revision: OfficialDocumentRevisionInput;
  readonly summarySource: string;
} = {
  label: "받은 공문 수정 및 핵심정리",
  revision: {
    original: "합성 안내 공문\n1. 대상: 합성 담당자\n2. 제출기한: 2030. 10. 30.\n붙임  1. 합성 서식 1부.  끝.",
    request: "대상 표현만 합성 실무자로 변경",
  },
  summarySource: "합성 안내 공문\n대상: 합성 담당자\n제출기한: 2030. 10. 30.\n제출방법: 합성 시스템 입력\n붙임  1. 합성 서식 1부.  끝.",
};

export const officialDocumentReferenceQualityFixture: {
  readonly input: OfficialDocumentInput;
  readonly reference: OfficialDocumentReferenceDraftSeed;
} = {
  input: {
    ...baseInput,
    purpose: "계획 기안",
    workArea: "기타",
    relatedDocument: "합성근거-REFERENCE-001",
    workName: "합성 참고자료 적용 계획",
    target: "합성 적용 대상",
    peopleCount: "합성 인원 25명",
  },
  reference: {
    templateBody: "1. 관련: [관련]\n2. 합성 참고자료 형식을 적용합니다.\n가. 대상: [대상]\n나. 인원: [인원]",
    attachmentExample: "합성 참고 서식, 합성 확인표",
    messengerExample: "[대상]에게 합성 참고자료 적용 내용을 안내합니다.",
    checklist: "합성 참고자료의 일반 문장만 사용했는지 확인",
    tableCopyText: "구분\t인원\n합성 대상\t[인원]",
    tableCopyGuide: "합성 표를 확인하세요.",
  },
};
