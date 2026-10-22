// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AiVideoFinder, type AiFinderConnection } from './AiVideoFinder';
import { searchChatGptWebNative } from '../chatgpt/webSearch';
const native = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke: native, isTauri: () => true }));
const url = 'https://www.youtube.com/watch?v=abcdefghijk';
const result = {
  checkedAt: '2026-10-22T10:00:00Z',
  sources: [{ url, title: '합성 검색 후보' }],
  text: JSON.stringify({ videos: [{ url, description: '합성 소개정보', relevance: '합성 관련성', reason: '원문 확인 필요' }] }),
};
function showFinder() {
  const connection: AiFinderConnection = {
    state: { status: 'connected', email: null, displayName: '합성 계정', planUsageEnabled: true, clientRegistrationExists: true, showPlanUsageNotice: false, notice: null, isLoading: false, isSigningIn: false, isDisconnecting: false, error: null },
    models: [{ slug: 'gpt-6.1-sol', displayName: '합성 모델' }],
    selectedModel: 'gpt-6.1-sol', setSelectedModel: vi.fn(), supportsWebSearch: true,
    searchWeb: prompt => searchChatGptWebNative('gpt-6.1-sol', prompt),
    generateText: vi.fn(async () => '미사용'),
  };
  render(<AiVideoFinder connection={connection} onClose={vi.fn()} onOpenSettings={vi.fn()} onOpenUrl={vi.fn(async () => {})} onSave={vi.fn(async () => {})} onDraft={vi.fn()} />);
}
function search() {
  fireEvent.change(screen.getByLabelText('교육 주제'), { target: { value: '합성 교육' } });
  fireEvent.click(screen.getByRole('button', { name: '교육영상 검색' }));
  fireEvent.click(screen.getByRole('button', { name: '확인 후 전송' }));
}
afterEach(() => { cleanup(); native.mockReset(); });
it('shows a synthetic sourced recommendation through the native IPC adapter', async () => {
  native.mockResolvedValue(result); showFinder(); search();
  await screen.findByRole('heading', { name: '합성 검색 후보' });
  expect(native).toHaveBeenCalledTimes(1);
});
it('blocks skipped search and removes previous cards without retrying', async () => {
  native.mockResolvedValueOnce(result).mockRejectedValueOnce({ code: 'searchNotPerformed' });
  showFinder(); search(); await screen.findByRole('heading', { name: '합성 검색 후보' });
  search();
  await screen.findByText('AI가 이번 요청에서 웹 검색을 실행하지 않았습니다. 확인되지 않은 영상은 추천하지 않습니다.');
  expect(screen.queryByRole('heading', { name: '합성 검색 후보' })).toBeNull();
  expect(native).toHaveBeenCalledTimes(2);
});
it('distinguishes an explicit empty candidate list from a malformed response', async () => {
  native.mockResolvedValue({ ...result, text: '{"videos":[]}', sources: [] }); showFinder(); search();
  await screen.findByText('확인 가능한 영상 검색 출처가 없습니다. 조건을 바꾸거나 직접 URL을 입력해 주세요.');
  expect(screen.queryByRole('heading', { name: '합성 검색 후보' })).toBeNull();
});
it('keeps rejected empty final output as the existing response error', async () => {
  native.mockRejectedValue({ code: 'invalidResponse' }); showFinder(); search();
  await screen.findByText('ChatGPT 응답을 확인할 수 없습니다.');
  expect(screen.queryByRole('heading', { name: '합성 검색 후보' })).toBeNull();
  expect(native).toHaveBeenCalledTimes(1);
});
it('never displays a candidate whose video URL differs from its source', async () => {
  native.mockResolvedValue({ ...result, sources: [{ url: 'https://www.youtube.com/watch?v=lmnopqrstuv', title: '다른 합성 출처' }] });
  showFinder(); search();
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('확인 가능한 영상 검색 출처가 없습니다.'));
  expect(screen.queryByRole('heading', { name: '다른 합성 출처' })).toBeNull();
  expect(screen.queryByRole('heading', { name: '합성 검색 후보' })).toBeNull();
});
