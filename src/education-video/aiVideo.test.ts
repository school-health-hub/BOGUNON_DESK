import { describe, expect, it } from 'vitest';
import { buildVideoSearchPrompt, canonicalVideoUrl, candidateDraftInput, parseVideoSearchResult } from './aiVideo';
const url = 'https://www.youtube.com/watch?v=abcdefghijk';
const item = { url, description: '공개 소개 요약', relevance: '교육 관련', reason: '교사 확인 필요' };
const result = (videos: unknown[], sources = [{ url, title: '출처의 제목' }]) => ({ text: JSON.stringify({ videos }), sources, checkedAt: '2026-10-22T00:00:00Z' });
describe('source backed education video search', () => {
  it('uses actual structured source title and leaves unverified metadata unknown', () => {
    const { candidates } = parseVideoSearchResult(result([{ ...item, title: 'invented', publisher: 'invented', durationSeconds: 100 }]));
    expect(candidates).toHaveLength(1); expect(candidates[0].title).toBe('출처의 제목');
    expect(candidates[0].publisher).toBeNull(); expect(candidates[0].durationSeconds).toBeNull();
  });
  it('excludes invented links and deduplicates results without padding', () => {
    expect(parseVideoSearchResult(result([item], [])).candidates).toEqual([]);
    const parsed = parseVideoSearchResult(result([item, item]));
    expect(parsed.candidates).toHaveLength(1); expect(parsed.excludedCount).toBe(1);
  });
  it('handles no results and rejects malformed responses', () => {
    expect(parseVideoSearchResult(result([])).candidates).toEqual([]);
    expect(() => parseVideoSearchResult({ ...result([]), text: 'not json' })).toThrow();
  });
  it('rejects unsafe URLs and accepts canonical video aliases', () => {
    expect(canonicalVideoUrl('https://youtu.be/abcdefghijk')?.url).toBe(url);
    for (const invalid of ['http://youtube.com/watch?v=abcdefghijk','https://youtube.com.evil.test/watch?v=abcdefghijk','https://user@youtube.com/watch?v=abcdefghijk','https://youtube.com:443/watch?v=abcdefghijk/']) expect(canonicalVideoUrl(invalid)).toBeNull();
  });
  it('does not invent missing school/date/budget in actual draft generator input', () => {
    const candidate = parseVideoSearchResult(result([item])).candidates[0];
    const input = candidateDraftInput(candidate, { topic: '감염병 예방교육', target: '초등학생', minutes: 10, publicFirst: true });
    expect(input.dateTime).toBe(''); expect(input.budget).toBe(''); expect(input.mainContent).toContain(url);
  });
  it('validates conditions and requests evidence rather than unsupported claims', () => {
    expect(() => buildVideoSearchPrompt({ topic: '', target: '초등학생', minutes: 10, publicFirst: true })).toThrow();
    expect(buildVideoSearchPrompt({ topic: '응급처치교육', target: '중학생', minutes: null, publicFirst: true })).toContain('실제 확인되지 않은');
  });
});
