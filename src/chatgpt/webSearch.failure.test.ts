import { beforeEach, expect, it, vi } from 'vitest';
import { ChatGptPlanRequestError, normalizeChatGptPlanError } from './chatgptPlanService';
import { parseWebSearchResult, searchChatGptWebNative } from './webSearch';
import { parseVideoSearchResult } from '../education-video/aiVideo';
const native = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke: native, isTauri: () => true }));
const fixture = { text: '{"videos":[]}', checkedAt: '2026-10-22T00:00:00Z', sources: [{ url: 'https://example.org/synthetic', title: 'Synthetic source' }] };
beforeEach(() => { native.mockReset(); });
it.each([
  ['invalidResponse', 'invalidResponse'],
  ['searchNotPerformed', 'searchNotPerformed'],
  ['reauthenticationRequired', 'reauthenticationRequired'],
  ['permissionDenied', 'accessDenied'],
  ['rateLimited', 'rateLimited'],
  ['temporaryFailure', 'temporaryFailure'],
  ['usageLimitExceeded', 'usageLimitExceeded'],
])('preserves synthetic native error %s without dispatching HTTP', async (code, expected) => {
  native.mockRejectedValue({ code, message: 'synthetic native DTO' });
  await expect(searchChatGptWebNative('gpt-6.1-sol', 'synthetic public topic')).rejects.toMatchObject({ code: expected });
});
it.each([null, {}, { ...fixture, sources: undefined }, { output: [], status: 'completed' }])('rejects a synthetic malformed IPC envelope', value => {
  expect(() => parseWebSearchResult(value)).toThrow(ChatGptPlanRequestError);
});
it('distinguishes valid empty video results from transport envelope failure', () => {
  expect(parseVideoSearchResult(parseWebSearchResult(fixture)).candidates).toEqual([]);
});
it('does not label malformed candidate JSON as the observed invalidResponse notice', () => {
  let observed: unknown;
  try { parseVideoSearchResult({ ...fixture, text: 'synthetic non-JSON text' }); } catch (error: unknown) { observed = error; }
  expect(normalizeChatGptPlanError(observed).code).toBe('unavailable');
});
it('maps invalidResponse to the exact observed UI notice', () => {
  expect(normalizeChatGptPlanError({ code: 'invalidResponse' }).message).toBe('ChatGPT 응답을 확인할 수 없습니다.');
});
it('preserves the safe skipped-search notice without provider details', () => {
  expect(normalizeChatGptPlanError({ code: 'searchNotPerformed', message: 'untrusted provider detail' }).message)
    .toBe('AI가 이번 요청에서 웹 검색을 실행하지 않았습니다. 확인되지 않은 영상은 추천하지 않습니다.');
});
it('accepts an explicit zero-video response without citations, but never invents candidates', () => {
  const empty = parseWebSearchResult({ ...fixture, sources: [] });
  expect(parseVideoSearchResult(empty)).toEqual({ candidates: [], excludedCount: 0 });
});
