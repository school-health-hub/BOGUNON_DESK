const QUICK_ADD_TITLE_LIMIT = 120;

export const memoToTaskDraft = (memo: string): string | null => {
  const firstLine = memo
    .split(/\r?\n/u)
    .map((line) => line.trim().replace(/\s+/gu, " "))
    .find((line) => line !== "");

  return firstLine === undefined ? null : firstLine.slice(0, QUICK_ADD_TITLE_LIMIT);
};
