import { describe, expect, it } from 'vitest';
import { buildRecommendationReasonsPrompt, parseRecommendationReasons } from './aiRecommendationReasons';
import type { AiVideoCandidate, SearchConditions } from './aiVideo';

const conditions: SearchConditions = { topic: '감염병 예방교육', target: '초등학생', minutes: 10, publicFirst: true };
const candidate = (videoId: string, verified: boolean): AiVideoCandidate => ({
  videoId,
  url: `https://www.youtube.com/watch?v=${videoId}`,
  title: verified ? '교사가 확인한 제목' : '확인 필요',
  publisher: verified ? '확인 기관' : null,
  durationSeconds: verified ? 600 : null,
  description: verified ? '교사가 작성한 메모' : '확인 필요',
  relevance: '확인 필요', reason: '기존 추천 이유',
  sources: [{ url: `https://www.youtube.com/watch?v=${videoId}`, title: '교사 입력' }],
  checkedAt: '2026-10-23T00:00:00Z', needsReview: true,
  provenance: verified ? 'teacher-confirmed' : 'teacher-supplied',
  metadataVerification: verified
    ? { title: 'teacher-confirmed', publisher: 'teacher-confirmed', durationSeconds: 'teacher-confirmed' }
    : { title: 'unverified', publisher: 'unverified', durationSeconds: 'unverified' },
});

describe('Finder recommendation reason contract', () => {
  it('includes only teacher-confirmed facts and forbids content-analysis claims', () => {
    const prompt = buildRecommendationReasonsPrompt([
      { candidate: candidate('abcdefghijk', true), conditions },
      { candidate: candidate('lmnopqrstuv', false), conditions: { ...conditions, topic: '응급처치교육', target: '고등학생' } },
    ]);
    expect(prompt).toContain('candidateId: abcdefghijk');
    expect(prompt).toContain('제목: 교사가 확인한 제목');
    expect(prompt).toContain('candidateId: lmnopqrstuv');
    expect(prompt).toContain('교육 주제: 응급처치교육');
    expect(prompt).not.toContain('URL:');
    expect(prompt).toContain('영상 시청이나 자막 분석을 했다고 표현하지 마세요');
  });

  it('accepts one to five complete reasons regardless of response order', () => {
    const parsed = parseRecommendationReasons(JSON.stringify({ reasons: [
      { candidateId: 'lmnopqrstuv', reason: '두 번째 후보 이유' },
      { candidateId: 'abcdefghijk', reason: '첫 번째 후보 이유' },
    ] }), ['abcdefghijk', 'lmnopqrstuv']);
    expect(parsed).toEqual({ abcdefghijk: '첫 번째 후보 이유', lmnopqrstuv: '두 번째 후보 이유' });
    expect(parseRecommendationReasons(JSON.stringify({ reasons: [{ candidateId: 'abcdefghijk', reason: '한 후보 이유' }] }), ['abcdefghijk']))
      .toEqual({ abcdefghijk: '한 후보 이유' });
    const fiveIds = ['abcdefghijk', 'lmnopqrstuv', 'zyxwvutsrqp', 'aaaabbbbccc', 'ddddeeeefff'];
    expect(Object.keys(parseRecommendationReasons(JSON.stringify({ reasons: fiveIds.map(candidateId => ({ candidateId, reason: `${candidateId} 후보 이유` })) }), fiveIds)))
      .toHaveLength(5);
  });

  it.each([
    ['not-json', ['abcdefghijk']],
    [JSON.stringify({ reasons: [] }), ['abcdefghijk']],
    [JSON.stringify({ reasons: [{ candidateId: 'abcdefghijk', reason: '' }] }), ['abcdefghijk']],
    [JSON.stringify({ reasons: [{ candidateId: 'unknown-id', reason: '이유' }] }), ['abcdefghijk']],
    [JSON.stringify({ reasons: [{ candidateId: 'abcdefghijk', reason: '이유' }, { candidateId: 'abcdefghijk', reason: '중복' }] }), ['abcdefghijk']],
    [JSON.stringify({ reasons: [{ candidateId: 'abcdefghijk', reason: '이유' }] }), ['abcdefghijk', 'lmnopqrstuv']],
    [JSON.stringify({ reasons: [{ candidateId: 'abcdefghijk', reason: '이유', url: 'https://youtu.be/abcdefghijk' }] }), ['abcdefghijk']],
    [JSON.stringify({ reasons: [{ candidateId: 'abcdefghijk', reason: '이유' }], title: '변경' }), ['abcdefghijk']],
    [JSON.stringify({ reasons: [{ candidateId: 'abcdefghijk', reason: '새 URL은 https://example.com 입니다.' }] }), ['abcdefghijk']],
    [JSON.stringify({ reasons: [{ candidateId: 'abcdefghijk', reason: '제목은 AI가 만든 새 제목입니다.' }] }), ['abcdefghijk']],
    [JSON.stringify({ reasons: [{ candidateId: 'abcdefghijk', reason: '영상 길이는 15분입니다.' }] }), ['abcdefghijk']],
  ])('rejects malformed, incomplete, duplicate, unknown or fact-changing output', (value, ids) => {
    expect(() => parseRecommendationReasons(value, ids)).toThrow();
  });

  it('rejects oversized reasons and more than five requested candidates', () => {
    expect(() => parseRecommendationReasons(JSON.stringify({ reasons: [{ candidateId: 'abcdefghijk', reason: '가'.repeat(601) }] }), ['abcdefghijk'])).toThrow();
    expect(() => buildRecommendationReasonsPrompt([
      'abcdefghijk', 'lmnopqrstuv', 'zyxwvutsrqp', 'aaaabbbbccc', 'ddddeeeefff', 'gggghhhhiii',
    ].map(videoId => ({ candidate: candidate(videoId, false), conditions })))).toThrow();
  });
});
