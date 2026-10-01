const DAY_IN_MS = 86_400_000;

export const DISPLAY_SCHEDULE_YEAR = 2026;
export const DISPLAY_SCHEDULE_MONTH_INDEX = 8;

export const isSameLocalDate = (left: Date, right: Date): boolean => (
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()
);

const addLocalCalendarDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const getMondayStartOfWeek = (now: Date): Date => {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);
  return monday;
};

export const getWeekDates = (now: Date): readonly [Date, Date, Date, Date, Date, Date, Date] => {
  const monday = getMondayStartOfWeek(now);
  return [
    monday,
    addLocalCalendarDays(monday, 1),
    addLocalCalendarDays(monday, 2),
    addLocalCalendarDays(monday, 3),
    addLocalCalendarDays(monday, 4),
    addLocalCalendarDays(monday, 5),
    addLocalCalendarDays(monday, 6),
  ];
};

export const isDisplayScheduleDate = (date: Date, day: number): boolean => (
  date.getFullYear() === DISPLAY_SCHEDULE_YEAR
  && date.getMonth() === DISPLAY_SCHEDULE_MONTH_INDEX
  && date.getDate() === day
);

export const parseLocalDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  return date.getFullYear() === year && date.getMonth() === monthIndex && date.getDate() === day
    ? date
    : null;
};

export const differenceInLocalCalendarDays = (target: Date, today: Date): number => {
  const targetUtc = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((targetUtc - todayUtc) / DAY_IN_MS);
};

export const formatDday = (targetDate: string, today: Date): string => {
  const target = parseLocalDate(targetDate);
  if (target === null) return "날짜 미정";

  const difference = differenceInLocalCalendarDays(target, today);
  if (difference === 0) return "D-Day";
  return difference > 0 ? `D-${difference}` : `D+${Math.abs(difference)}`;
};

export const formatRemainingUntil = (now: Date, hour: number, minute = 0): string => {
  const deadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
  const remainingMinutes = Math.ceil((deadline.getTime() - now.getTime()) / 60_000);

  if (remainingMinutes <= 0) return "마감 시간이 지났습니다";
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  if (hours === 0) return `${minutes}분 남음`;
  if (minutes === 0) return `${hours}시간 남음`;
  return `${hours}시간 ${minutes}분 남음`;
};
