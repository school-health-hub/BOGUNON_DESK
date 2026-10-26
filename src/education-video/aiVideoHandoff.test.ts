import { describe, expect, it } from 'vitest';
import { buildYouTubeSearchHandoff, parseTeacherVideoUrls } from './aiVideoHandoff';

describe('Finder teacher URL fallback contract', () => {
  it('normalizes supported watch, short and Shorts URLs', () => {
    const parsed = parseTeacherVideoUrls([
      'https://www.youtube.com/watch?v=abcdefghijk',
      'https://youtu.be/lmnopqrstuv',
      'https://www.youtube.com/shorts/zyxwvutsrqp',
    ].join('\n'), []);
    expect(parsed.videos).toEqual([
      { videoId: 'abcdefghijk', url: 'https://www.youtube.com/watch?v=abcdefghijk' },
      { videoId: 'lmnopqrstuv', url: 'https://www.youtube.com/watch?v=lmnopqrstuv' },
      { videoId: 'zyxwvutsrqp', url: 'https://www.youtube.com/watch?v=zyxwvutsrqp' },
    ]);
    expect(parsed.errors).toEqual([]);
  });

  it('keeps valid mixed lines while reporting invalid and duplicate line numbers', () => {
    const parsed = parseTeacherVideoUrls([
      'https://youtu.be/abcdefghijk',
      'https://example.com/watch?v=lmnopqrstuv',
      'https://www.youtube.com/watch?v=abcdefghijk',
      'https://www.youtube.com/shorts/lmnopqrstuv',
    ].join('\n'), ['lmnopqrstuv']);
    expect(parsed.videos).toEqual([{ videoId: 'abcdefghijk', url: 'https://www.youtube.com/watch?v=abcdefghijk' }]);
    expect(parsed.errors).toEqual([
      { line: 2, reason: '지원되는 HTTPS YouTube 개별 영상 URL이 아닙니다.' },
      { line: 3, reason: '같은 영상이 입력에 중복되어 있습니다.' },
      { line: 4, reason: '이미 후보 목록에 있는 영상입니다.' },
    ]);
  });

  it('builds a visible query and allowlisted YouTube results URL from conditions', () => {
    const handoff = buildYouTubeSearchHandoff({ topic: '감염병 예방', target: '초등학생', minutes: 10, publicFirst: true });
    expect(handoff.query).toBe('감염병 예방 초등학생 교육 영상 10분 공공기관 교육기관');
    const url = new URL(handoff.url);
    expect(url.origin).toBe('https://www.youtube.com');
    expect(url.pathname).toBe('/results');
    expect(url.searchParams.get('search_query')).toBe(handoff.query);
  });

  it('reuses the existing search-condition validation contract', () => {
    expect(() => buildYouTubeSearchHandoff({ topic: '', target: '초등학생', minutes: 10, publicFirst: true })).toThrow();
    expect(() => buildYouTubeSearchHandoff({ topic: '감염병 예방', target: '임의 대상', minutes: 10, publicFirst: true })).toThrow();
  });
});
