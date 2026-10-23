const DAY_IN_MS = 86_400_000;

export const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const calendarCells = (year: number, monthIndex: number): readonly (number | null)[] => {
  const leading = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const count = Math.ceil((leading + days) / 7) * 7;
  return Array.from({ length: count }, (_, index) => {
    const day = index - leading + 1;
    return day > 0 && day <= days ? day : null;
  });
};

export const calculateRemainingDays = (target: string, base: Date): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(target);
  if (match === null) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const targetDate = new Date(year, monthIndex, day);
  if (targetDate.getFullYear() !== year || targetDate.getMonth() !== monthIndex || targetDate.getDate() !== day) return null;
  const targetUtc = Date.UTC(year, monthIndex, day);
  const baseUtc = Date.UTC(base.getFullYear(), base.getMonth(), base.getDate());
  return Math.round((targetUtc - baseUtc) / DAY_IN_MS);
};

export const formatDday = (remainingDays: number): string => {
  if (remainingDays === 0) return "D-Day";
  return remainingDays > 0 ? `D-${remainingDays}` : `D+${Math.abs(remainingDays)}`;
};
