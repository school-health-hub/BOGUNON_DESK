export type RecommendationReason =
  | { readonly status: 'ai-generated' | 'teacher-edited'; readonly text: string }
  | { readonly status: 'deleted' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseRecommendationReason(value: unknown): RecommendationReason {
  if (!isRecord(value) || typeof value.status !== 'string') throw new Error('추천 이유 저장 형식이 올바르지 않습니다.');
  const keys = Object.keys(value);
  if (value.status === 'deleted') {
    if (keys.length !== 1) throw new Error('삭제된 추천 이유 저장 형식이 올바르지 않습니다.');
    return { status: 'deleted' };
  }
  if ((value.status !== 'ai-generated' && value.status !== 'teacher-edited') || keys.length !== 2 || typeof value.text !== 'string') {
    throw new Error('추천 이유 저장 형식이 올바르지 않습니다.');
  }
  const text = value.text.trim();
  if (!text || text !== value.text || [...text].length > 600 || text.includes('\0')) throw new Error('추천 이유 저장 형식이 올바르지 않습니다.');
  return { status: value.status, text };
}

export const activeRecommendationReason = (reason: RecommendationReason | undefined): string | null =>
  reason === undefined || reason.status === 'deleted' || reason.text.trim()==='' ? null : reason.text.trim();
