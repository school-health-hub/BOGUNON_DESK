import { describe, expect, it, vi } from 'vitest';
import { createSearchOperation, nativeSearchDependencies } from './searchService';

const api = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: api.invoke, isTauri: () => true }));
const conditions = { topic: '합성 교육', target: 'QA 대상', minutes: 10 };
const request = { topic: '합성 교육', audience: 'QA 대상', desiredMinutes: 10 };
const response = { source: 'synthetic-mock', notice: '합성 계약 QA', results: [] };
const getSession = async () => ({ accessToken: 'synthetic-token-only', userId: 'qa-user', expiresAt: Date.now() + 60_000 });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('logical Finder request identity', () => {
  it('creates a new UUID for each new logical search', () => {
    const first = createSearchOperation(conditions);
    const second = createSearchOperation(conditions);
    expect(first.requestId).toMatch(uuid);
    expect(second.requestId).toMatch(uuid);
    expect(first.requestId).not.toBe(second.requestId);
  });

  it('retains the same UUID and condition snapshot on transport retry', async () => {
    const input = { ...conditions };
    const operation = createSearchOperation(input);
    input.topic = 'different new input';
    const transport = vi.fn().mockRejectedValueOnce({ code: 'TIMEOUT' }).mockResolvedValueOnce(response);
    const dependencies = { getSession, transport };
    await expect(operation.execute('signedIn', dependencies, 'qa-user')).rejects.toMatchObject({ code: 'TIMEOUT' });
    await expect(operation.execute('signedIn', dependencies, 'qa-user')).resolves.toMatchObject(response);
    expect(transport.mock.calls).toEqual([
      [request, 'synthetic-token-only', operation.requestId],
      [request, 'synthetic-token-only', operation.requestId],
    ]);
  });

  it('passes the UUID to the dedicated Tauri IPC without changing business JSON', async () => {
    const operation = createSearchOperation(conditions);
    api.invoke.mockResolvedValue(response);
    await nativeSearchDependencies.transport(request, 'synthetic-token-only', operation.requestId);
    expect(api.invoke).toHaveBeenCalledWith('education_video_search', {
      request, accessToken: 'synthetic-token-only', requestId: operation.requestId,
    });
  });

  it.each([
    ['SEARCH_BUSY', '같은 검색을 처리 중입니다. 잠시 후 다시 시도해 주세요.'],
    ['NOT_CONFIGURED', '서버 검색 설정이 준비되지 않았습니다.'],
    ['UNAUTHORIZED', '서버 검색은 BOGUNON 로그인이 필요합니다.'],
    ['UNRECOGNIZED_PRIVATE_CODE', '검색 요청을 처리하지 못했습니다.'],
  ])('shows only the fixed safe message for %s', async (code, message) => {
    const operation = createSearchOperation(conditions);
    const transport = async () => { throw { code, message: 'PRIVATE_UPSTREAM_BODY' }; };
    await expect(operation.execute('signedIn', { getSession, transport }, 'qa-user')).rejects.toMatchObject({ message });
  });
});
