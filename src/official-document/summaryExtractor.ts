export type OfficialDocumentSummaryField = {
  readonly value: string | null;
  readonly evidence: string | null;
};

export type OfficialDocumentLocalSummary = {
  readonly actions: readonly OfficialDocumentSummaryField[];
  readonly target: OfficialDocumentSummaryField;
  readonly deadline: OfficialDocumentSummaryField;
  readonly submissionMethod: OfficialDocumentSummaryField;
  readonly materials: readonly OfficialDocumentSummaryField[];
  readonly attachments: readonly OfficialDocumentSummaryField[];
  readonly contact: OfficialDocumentSummaryField;
};

type SourceLine = {
  readonly raw: string;
  readonly normalized: string;
};

const targetLabels = [
  "제출대상",
  "신청대상",
  "참석대상",
  "교육대상",
  "해당학교",
  "해당 기관",
  "대상",
] as const;

const deadlineLabels = [
  "제출기한",
  "제출 기간",
  "제출기간",
  "신청기한",
  "신청 기간",
  "신청기간",
  "회신기한",
  "회신 기간",
  "회신기간",
  "등록기한",
  "등록기간",
  "기한",
] as const;

const methodLabels = [
  "제출방법",
  "제출 방법",
  "신청방법",
  "신청 방법",
  "회신방법",
  "회신 방법",
  "제출처",
  "제출 경로",
] as const;

const materialLabels = [
  "제출자료",
  "제출 자료",
  "제출서류",
  "제출 서류",
  "제출내용",
  "제출 내용",
  "제출파일",
  "제출 파일",
  "제출서식",
  "제출 서식",
] as const;

const contactLabels = ["문의처", "문의", "담당자", "담당", "연락처"] as const;
const listMarkerPattern = /^(?:[-*•·○□■]\s+|\d+[.)]\s+)/;
const attachmentBulletPattern = /^[-*•·○□■]\s+/;
const prefixPattern = /^(?:[○●□■◆◇▶▷※·•*-]\s*|[가-하]\.\s*)+/;
const sectionLabelPattern = /^(?:대상|일시|장소|방법|제출기한|제출\s*기간|신청기한|신청\s*기간|회신기한|회신\s*기간|등록기한|등록기간|제출방법|제출\s*방법|신청방법|신청\s*방법|회신방법|회신\s*방법|제출자료|제출\s*자료|제출서류|제출\s*서류|붙임|첨부|문의처|문의|담당자|담당|연락처)\s*[:：]?/;
const actionPattern = /(?:제출|신청|회신|등록|입력|참석|확인)(?:하여|해)?\s*(?:주시기\s+바랍니다|바랍니다)/;

const missingField = (): OfficialDocumentSummaryField => ({ value: null, evidence: null });

const toSourceLines = (source: string): readonly SourceLine[] => source
  .split(/\r?\n/)
  .map((rawLine) => rawLine.trim())
  .filter((rawLine) => rawLine !== "")
  .map((raw) => ({ raw, normalized: raw.replace(/[\t ]+/g, " ") }));

const withoutPrefix = (line: string): string => line.replace(prefixPattern, "").trim();

const matchLabel = (
  line: SourceLine,
  labels: readonly string[],
): { readonly remainder: string } | null => {
  const labelPattern = labels.map((label) => label.replace(/\s+/g, "\\s*")).join("|");
  const match = withoutPrefix(line.normalized).match(new RegExp(`^(?:${labelPattern})\\s*[:：]?\\s*(.*)$`));
  return match === null ? null : { remainder: match[1]?.trim() ?? "" };
};

const isSectionBoundary = (line: SourceLine): boolean => {
  if (listMarkerPattern.test(line.normalized)) return false;
  return sectionLabelPattern.test(withoutPrefix(line.normalized));
};

const extractScalarField = (
  lines: readonly SourceLine[],
  labels: readonly string[],
  transform: (value: string) => string | null = (value) => value,
): OfficialDocumentSummaryField => {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) continue;
    const match = matchLabel(line, labels);
    if (match === null) continue;
    if (match.remainder !== "") {
      const value = transform(match.remainder);
      if (value !== null && value !== "") return { value, evidence: line.raw };
    }
    const next = lines[index + 1];
    if (next !== undefined && !isSectionBoundary(next) && !listMarkerPattern.test(next.normalized)) {
      const value = transform(next.normalized);
      if (value !== null && value !== "") {
        return { value, evidence: `${line.raw}\n${next.raw}` };
      }
    }
  }
  return missingField();
};

const extractDateExpression = (value: string): string | null => {
  const patterns = [
    /\d{4}-\d{1,2}-\d{1,2}/,
    /\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?(?:\([^)]+\))?(?:\s*~\s*(?:(?:\d{4}\.\s*)?\d{1,2}\.\s*\d{1,2}\.?(?:\([^)]+\))?))?/,
    /(?:\d{4}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일(?:\([^)]+\))?(?:\s*~\s*(?:(?:\d{4}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일(?:\([^)]+\))?))?/,
    /\d{1,2}\.\s*\d{1,2}\.?(?:\([^)]+\))?(?:\s*~\s*\d{1,2}\.\s*\d{1,2}\.?(?:\([^)]+\))?)?/,
  ] as const;
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[0] !== undefined) return match[0].trim();
  }
  return null;
};

const stripListMarker = (value: string): string => value.replace(listMarkerPattern, "").trim();

const collectMaterials = (lines: readonly SourceLine[]): readonly OfficialDocumentSummaryField[] => {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) continue;
    const match = matchLabel(line, materialLabels);
    if (match === null) continue;
    const items: OfficialDocumentSummaryField[] = [];
    if (match.remainder !== "") {
      items.push({ value: stripListMarker(match.remainder), evidence: line.raw });
    }
    for (let offset = index + 1; offset < lines.length && items.length < 10; offset += 1) {
      const candidate = lines[offset];
      if (candidate === undefined || isSectionBoundary(candidate)) break;
      if (!listMarkerPattern.test(candidate.normalized)) break;
      const value = stripListMarker(candidate.normalized);
      if (value !== "") items.push({ value, evidence: candidate.raw });
    }
    return items;
  }
  return [];
};

const matchAttachmentStart = (line: SourceLine): string | null => {
  const match = withoutPrefix(line.normalized).match(/^(?:붙임|첨부)(?![을를이가은는과와])\s*[:：]?\s*(.*)$/);
  const remainder = match?.[1]?.trim();
  if (remainder === undefined || /참고/.test(remainder)) return null;
  return remainder;
};

const cleanAttachmentValue = (value: string): string => value
  .replace(attachmentBulletPattern, "")
  .replace(/\s*끝\.\s*$/, "")
  .trim();

const collectAttachments = (lines: readonly SourceLine[]): readonly OfficialDocumentSummaryField[] => {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) continue;
    if (listMarkerPattern.test(line.normalized)) continue;
    const remainder = matchAttachmentStart(line);
    if (remainder === null) continue;
    const items: OfficialDocumentSummaryField[] = [];
    if (remainder !== "") {
      const value = cleanAttachmentValue(remainder);
      if (value !== "") items.push({ value, evidence: line.raw });
    }
    for (let offset = index + 1; offset < lines.length && items.length < 10; offset += 1) {
      const candidate = lines[offset];
      if (candidate === undefined || isSectionBoundary(candidate)) break;
      if (!/^\d+[.)]\s+/.test(candidate.normalized)) break;
      const value = cleanAttachmentValue(candidate.normalized);
      if (value !== "") items.push({ value, evidence: candidate.raw });
    }
    return items;
  }
  return [];
};

const extractActions = (lines: readonly SourceLine[]): readonly OfficialDocumentSummaryField[] => lines
  .map((line, index) => ({
    line,
    index,
    score: /주시기\s+바랍니다/.test(line.normalized) ? 2 : 1,
  }))
  .filter(({ line }) => actionPattern.test(line.normalized))
  .sort((left, right) => right.score - left.score || left.index - right.index)
  .slice(0, 3)
  .map(({ line }) => ({
    value: withoutPrefix(line.normalized),
    evidence: line.raw,
  }));

export const extractOfficialDocumentSummary = (source: string): OfficialDocumentLocalSummary => {
  const lines = toSourceLines(source);
  return {
    actions: extractActions(lines),
    target: extractScalarField(lines, targetLabels),
    deadline: extractScalarField(lines, deadlineLabels, extractDateExpression),
    submissionMethod: extractScalarField(lines, methodLabels),
    materials: collectMaterials(lines),
    attachments: collectAttachments(lines),
    contact: extractScalarField(lines, contactLabels),
  };
};

const formatSummaryList = (fields: readonly OfficialDocumentSummaryField[]): string => fields.length === 0
  ? "확인 필요"
  : fields.map((field) => `- ${field.value ?? "확인 필요"}`).join("\n");

export const formatOfficialDocumentSummary = (summary: OfficialDocumentLocalSummary): string => [
  `[내가 해야 할 일]\n${formatSummaryList(summary.actions)}`,
  `[대상]\n${summary.target.value ?? "확인 필요"}`,
  `[제출기한]\n${summary.deadline.value ?? "확인 필요"}`,
  `[제출방법]\n${summary.submissionMethod.value ?? "확인 필요"}`,
  `[제출자료]\n${formatSummaryList(summary.materials)}`,
  `[붙임]\n${formatSummaryList(summary.attachments)}`,
  `[담당자 확인사항]\n${summary.contact.value ?? "확인 필요"}`,
].join("\n\n");
