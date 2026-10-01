export type DateDifferenceResult =
  | { readonly status: "ready"; readonly days: number; readonly inclusiveDays: number }
  | { readonly status: "invalid" | "reversed" };

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

const parseUtcCalendarDate = (value: string): number | null => {
  const match = DATE_PATTERN.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? timestamp
    : null;
};

export const calculateDateDifference = (start: string, end: string): DateDifferenceResult => {
  const startTimestamp = parseUtcCalendarDate(start);
  const endTimestamp = parseUtcCalendarDate(end);
  if (startTimestamp === null || endTimestamp === null) return { status: "invalid" };
  if (endTimestamp < startTimestamp) return { status: "reversed" };
  const days = Math.round((endTimestamp - startTimestamp) / DAY_MS);
  return { status: "ready", days, inclusiveDays: days + 1 };
};
