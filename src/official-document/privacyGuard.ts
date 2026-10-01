export type OfficialDocumentPrivacyResult = {
  readonly isSafe: boolean;
  readonly findings: readonly string[];
};

type PrivacyPattern = {
  readonly label: string;
  readonly pattern: RegExp;
};

const privacyPatterns: readonly PrivacyPattern[] = [
  { label: "학생 이름", pattern: /(?:학생명|성명|이름)\s*[:：]?\s*[가-힣]{2,4}/ },
  { label: "학번", pattern: /(?:학번|학생번호)\s*[:：]?\s*\d{4,}/ },
  { label: "연락처", pattern: /(?:연락처\s*[:：]?\s*)?(?:01[016789]-?\d{3,4}-?\d{4})/ },
  { label: "건강정보", pattern: /(?:질병|증상|진단명?|검사결과|장애|특수교육|치료|상담\s*내용|병원)\s*[:：]\s*\S+/ },
  { label: "개인 식별 사고 내용", pattern: /(?:학생|대상자)\s+[가-힣]{2,4}\s*(?:은|는|이|가)?\s*(?:사고|부상|응급|병원|상담)/ },
] as const;

export const inspectOfficialDocumentPrivacy = (text: string): OfficialDocumentPrivacyResult => {
  const findings = privacyPatterns
    .filter((candidate) => candidate.pattern.test(text))
    .map((candidate) => candidate.label)
    .filter((label, index, all) => all.indexOf(label) === index);
  return { isSafe: findings.length === 0, findings };
};

export const officialDocumentPrivacyNotice =
  "자동 개인정보 검사는 보조 기능이며 모든 개인정보를 탐지하지 못할 수 있습니다. AI 서비스로 보내기 전 전송 내용을 최종 확인해 주세요.";
