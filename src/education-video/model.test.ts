import { describe, expect, it } from 'vitest';
import { validateConditions, durationSeconds, safeVideoUrl, searchMockVideos, filterVideos, officialEvidence, createMessage } from './model';
describe('education video domain', () => {
    it('rejects empty topic and invalid duration', () => { expect(validateConditions({ topic: '', target: '학생', minutes: 0 })).not.toBeNull(); });
    it('parses ISO durations accurately', () => { expect(durationSeconds('PT1H2M3S')).toBe(3723); expect(durationSeconds('bad')).toBeNull(); });
    it('rejects credential urls and extra query data', () => { expect(safeVideoUrl('https://evil.test/watch?v=EVmock00001')).toBeNull(); expect(safeVideoUrl('https://www.youtube.com/watch?v=EVmock00001&key=secret')).toBeNull(); });
    it('creates twelve synthetic results and applies inclusive window', () => { const rows = searchMockVideos({ topic: '손씻기', target: '초등', minutes: 10 }); expect(rows).toHaveLength(12); expect(filterVideos(rows, 10, 3).every(v => Math.abs(v.durationSeconds - 600) <= 180)).toBe(true); });
    it('does not infer official status from names', () => { expect(officialEvidence('unknown')).toBeNull(); expect(officialEvidence('mock-verified-health')).toContain('합성'); });
    it('does not invent missing fields', () => { expect(createMessage({ educationTitle: '', target: '', schedule: '', instructions: '' }, null)).toEqual({ text: '', missing: ['교육명', '대상', '교육 일시 또는 시청 기간', '영상 선택', '안내사항'] }); });
});
it('rejects inherited registry keys', () => { expect(officialEvidence('__proto__')).toBeNull(); expect(officialEvidence('constructor')).toBeNull(); });
it('creates multiline mock labeled message and reports clipboard failure', async () => { const video = searchMockVideos({ topic: '손씻기', target: '학생', minutes: 10 })[0]; const result = createMessage({ educationTitle: '교육', target: '학생', schedule: '이번주', instructions: '확인' }, video); expect(result.text.split(String.fromCharCode(10)).length).toBeGreaterThan(5); expect(result.text).toContain('합성 Mock'); });
it('handles every clipboard rejection without leaking details', async () => { const { copyMessage } = await import('./model'); for (const value of [new DOMException('denied'), { secret: 'never show' }, null]) {
    expect(await copyMessage('text', true, () => Promise.reject(value))).toContain('복사하지 못했습니다');
} let called = false; await copyMessage('text', false, async () => { called = true; }); expect(called).toBe(false); expect(await copyMessage('text', true, async () => { })).toBe('안내문을 복사했습니다.'); });
it('rejects zero and overflow duration', () => { expect(durationSeconds('PT0S')).toBeNull(); expect(durationSeconds('PT999999999999999999999999H')).toBeNull(); });
it('uses stable per-query fixture identities', () => { const a = searchMockVideos({ topic: '손씻기', target: '학생', minutes: 10 }); const b = searchMockVideos({ topic: '흡연예방', target: '학생', minutes: 10 }); expect(a[0].videoId).not.toBe(b[0].videoId); expect(a[0].videoId).toBe(searchMockVideos({ topic: '손씻기', target: '학생', minutes: 10 })[0].videoId); });
