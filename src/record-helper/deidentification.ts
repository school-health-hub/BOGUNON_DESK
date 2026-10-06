export type RecordHelperDeidentificationInput = {
  readonly reportText: string;
  readonly teacherMemo: string;
  readonly studentLabel: string;
  readonly classLabel: string;
};

export type RecordHelperDeidentificationResult = {
  readonly reportText: string;
  readonly teacherMemo: string;
  readonly redactions: readonly string[];
  readonly blockers: readonly string[];
};

type RedactionRule = {
  readonly label: string;
  readonly pattern: RegExp;
  readonly replacement: string;
};

const rules: readonly RedactionRule[] = [
  { label: "주민등록번호", pattern: /\b\d{6}[-\s]?[1-4]\d{6}\b/g, replacement: "[학생 식별정보 제거]" },
  { label: "연락처", pattern: /연락처(?:\s*[:：]\s*(?:01[016789][-\s]?\d{3,4}[-\s]?\d{4}|\S+)|\s+01[016789][-\s]?\d{3,4}[-\s]?\d{4})/g, replacement: "[연락처 제거]" },
  { label: "휴대전화번호", pattern: /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g, replacement: "[연락처 제거]" },
  { label: "이메일", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[이메일 제거]" },
  { label: "학번", pattern: /(?:학번|학생번호)(?:\s*[:：]\s*|\s+)\d{1,12}\b/g, replacement: "[학번 제거]" },
  { label: "학생 이름", pattern: /(?:학생명|성명|이름)(?:\s*[:：]\s*|\s+)[가-힣]{2,4}(?![가-힣])/g, replacement: "[학생]" },
  { label: "학생 식별 조합", pattern: /\d{1,2}\s*학년\s*\d{1,2}\s*반\s*\d{1,3}\s*번/g, replacement: "[학생 식별정보 제거]" },
] as const;

const sensitivePatterns: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: "진단", pattern: /진단/ }, { label: "질병", pattern: /질병/ },
  { label: "치료", pattern: /치료/ }, { label: "병원", pattern: /병원/ },
  { label: "상담", pattern: /상담/ }, { label: "검사 결과", pattern: /검사\s*결과/ },
  { label: "장애", pattern: /장애/ }, { label: "특수교육", pattern: /특수교육/ },
] as const;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const redactText = (text: string, hints: readonly string[]): { readonly text: string; readonly redactions: readonly string[] } => {
  let next = text;
  const redactions: string[] = [];
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    const count = next.match(rule.pattern)?.length ?? 0;
    if (count === 0) continue;
    rule.pattern.lastIndex = 0;
    next = next.replace(rule.pattern, rule.replacement);
    redactions.push(...Array.from({ length: count }, () => rule.label));
  }
  for (const hint of hints) {
    const trimmed = hint.trim();
    if (trimmed === "" || !next.includes(trimmed)) continue;
    const count = next.split(trimmed).length - 1;
    next = next.replace(new RegExp(escapeRegExp(trimmed), "g"), "[학생]");
    redactions.push(...Array.from({ length: count }, () => "입력된 학생 정보"));
  }
  return { text: next, redactions };
};

export const inspectRecordHelperSensitiveContent = (text: string): readonly string[] => (
  sensitivePatterns.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label)
);

export const inspectRecordHelperIdentityContent = (
  text: string,
  identityHints: readonly string[] = [],
): readonly string[] => {
  const findings = rules.flatMap(({ label, pattern }) => {
    pattern.lastIndex = 0;
    const found = pattern.test(text);
    pattern.lastIndex = 0;
    return found ? [label] : [];
  });
  const containsIdentityHint = identityHints.some((hint) => {
    const trimmed = hint.trim();
    return trimmed !== "" && text.includes(trimmed);
  });
  return containsIdentityHint ? [...findings, "입력된 학생 정보"] : findings;
};

export const deidentifyRecordHelperContent = ({
  reportText,
  teacherMemo,
  studentLabel,
  classLabel,
}: RecordHelperDeidentificationInput): RecordHelperDeidentificationResult => {
  const hints = [studentLabel, classLabel];
  const report = redactText(reportText, hints);
  const memo = redactText(teacherMemo, hints);
  const blockers = inspectRecordHelperSensitiveContent(`${report.text}\n${memo.text}`);
  return {
    reportText: report.text,
    teacherMemo: memo.text,
    redactions: [...report.redactions, ...memo.redactions],
    blockers,
  };
};
