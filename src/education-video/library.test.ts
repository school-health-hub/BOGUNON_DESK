import { describe, expect, it } from 'vitest';
import { mergeLibrary, parseLibrary } from './library';
import { searchMockVideos, type LibraryItem } from './model';
const video = searchMockVideos({ topic: '손씻기', target: '학생', minutes: 10 })[0];
const item: LibraryItem = { ...video, educationTitle: '예방교육', target: '학생', schedule: '10월', instructions: '확인', message: '교사 수정', notes: '사용자 메모' };
describe('library boundary', () => {
    it('rejects corrupt JSON', () => { expect(() => parseLibrary('{')).toThrow('손상'); });
    it('rejects unsupported versions and secrets', () => { expect(() => parseLibrary('{"version":2,"items":[]}')).toThrow(); expect(() => parseLibrary(JSON.stringify({ version: 1, items: [{ ...item, accessToken: 'secret' }] }))).toThrow(); });
    it('preserves existing edits when merging another file', () => { const old = { version: 1, items: [item] } as const; const result = mergeLibrary(old, { version: 1, items: [{ ...item, notes: 'new', message: 'new' }] }); expect(result.items).toEqual([item]); });
    it('rejects duplicate IDs within a document without changing existing data', () => { const original = JSON.stringify({ version: 1, items: [item] }); expect(() => parseLibrary(JSON.stringify({ version: 1, items: [item, item] }))).toThrow('중복'); expect(parseLibrary(original).items).toEqual([item]); });
});
