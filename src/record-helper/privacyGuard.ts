import type { RecordHelperPrivacyResult } from "./types";

type PrivacyPattern = {
  readonly label: string;
  readonly pattern: RegExp;
};

const privacyPatterns: readonly PrivacyPattern[] = [
  { label: "학생 이름", pattern: /(?:학생명|성명|이름)\s*[:：]?\s*[가-힣]{2,4}/ },
  { label: "학번", pattern: /(?:학번|학생번호)\s*[:：]?\s*\d{3,12}/ },
  { label: "휴대전화번호", pattern: /(?:01[016789])[-\s]?\d{3,4}[-\s]?\d{4}/ },
  { label: "주민등록번호", pattern: /\d{6}[-\s]?[1-4]\d{6}/ },
  { label: "이메일", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  { label: "연락처", pattern: /연락처\s*[:：]?\s*\S+/ },
  { label: "건강·민감정보", pattern: /(?:진단명|질병|치료|병원|상담\s*내용|검사\s*결과|장애|특수교육)/ },
] as const;

export const inspectRecordHelperPrivacy = (text: string): RecordHelperPrivacyResult => {
  const findings = privacyPatterns
    .filter((candidate) => candidate.pattern.test(text))
    .map((candidate) => candidate.label)
    .filter((label, index, all) => all.indexOf(label) === index);

  return { isSafe: findings.length === 0, findings };
};

export const recordHelperPrivacyNotice =
  "자동 개인정보 검사는 보조 기능이며 모든 정보를 탐지하지 못할 수 있습니다.";
