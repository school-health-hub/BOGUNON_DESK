const URL_CANDIDATE_PATTERN = /https?:\/\/[^\s<>"']+/giu;
const TRAILING_PUNCTUATION_PATTERN = /[.,!?;:)\]\}]+$/u;
const MAX_VISIBLE_URLS = 5;

const parseMemoUrl = (candidate: string): string | null => {
  const trimmed = candidate.replace(TRAILING_PUNCTUATION_PATTERN, "");
  try {
    const parsed = new URL(trimmed);
    if (!(["http:", "https:"] as const).some((protocol) => protocol === parsed.protocol)) return null;
    return parsed.hostname === "" ? null : parsed.toString();
  } catch (error: unknown) {
    if (error instanceof TypeError) return null;
    throw error;
  }
};

export const extractMemoUrls = (memo: string): readonly string[] => {
  const uniqueUrls = new Set<string>();
  for (const match of memo.matchAll(URL_CANDIDATE_PATTERN)) {
    const parsed = parseMemoUrl(match[0]);
    if (parsed !== null) uniqueUrls.add(parsed);
    if (uniqueUrls.size === MAX_VISIBLE_URLS) break;
  }
  return [...uniqueUrls];
};
