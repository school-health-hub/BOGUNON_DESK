import type {
  QuickAddArea,
  QuickAddTaskCategory,
  QuickAddTaskPriority,
} from "../workspace-data/workItemCreateTypes";
import type { OfficialDocumentLocalSummary } from "./summaryExtractor";

export type OfficialDocumentQuickAddDraft = {
  readonly title: string;
  readonly dueDate: string | null;
  readonly area: QuickAddArea;
  readonly category: QuickAddTaskCategory;
  readonly priority: QuickAddTaskPriority;
};

const toValidIsoDate = (year: number, month: number, day: number): string | null => {
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
  if (day > (daysInMonth[month - 1] ?? 0)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export const parseExplicitOfficialDocumentDate = (value: string | null): string | null => {
  if (value === null) return null;
  const source = value.trim();
  if (/[~～]/.test(source)) return null;

  const patterns = [
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?(?:\([^)]+\))?$/,
    /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일(?:\([^)]+\))?$/,
  ] as const;
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match === null) continue;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return toValidIsoDate(year, month, day);
  }
  return null;
};

const taskTitleFromAction = (action: string | null): string => {
  if (action === null) return "공문 확인 및 처리";
  const withoutEnding = action
    .trim()
    .replace(/[.!?。]+$/u, "")
    .replace(/(?:하여|해)?\s*주시기\s+바랍니다$/u, "")
    .replace(/\s*바랍니다$/u, "")
    .trim();
  const withoutObjectParticle = withoutEnding.replace(
    /^(.+?)(?:을|를)\s+(제출|신청|회신|등록|입력|확인)$/u,
    "$1 $2",
  );
  return (withoutObjectParticle === "" ? "공문 확인 및 처리" : withoutObjectParticle).slice(0, 120);
};

export const createOfficialDocumentQuickAddDraft = (
  summary: OfficialDocumentLocalSummary,
): OfficialDocumentQuickAddDraft => ({
  title: taskTitleFromAction(summary.actions[0]?.value ?? null),
  dueDate: parseExplicitOfficialDocumentDate(summary.deadline.value),
  area: "healthWork",
  category: "officialDocument",
  priority: "normal",
});
