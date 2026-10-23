// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiVideoFinder, type AiFinderConnection } from './AiVideoFinder';
import type { WebSearchResult } from '../chatgpt/webSearch';
const result: WebSearchResult = { checkedAt: '2026-10-22T10:00:00Z', sources: [{ url: 'https://www.youtube.com/watch?v=abcdefghijk', title: '합성 교육영상' }], text: JSON.stringify({ videos: [{ url: 'https://www.youtube.com/watch?v=abcdefghijk', description: '공개 소개정보', relevance: '교육 주제 관련', reason: '내용 직접 확인' }] }) };
const connection = (): AiFinderConnection => ({ state: { status: 'connected', email: 'synthetic@example.test', displayName: '합성 계정', planUsageEnabled: true, clientRegistrationExists: true, showPlanUsageNotice: false, notice: null, isLoading: false, isSigningIn: false, isDisconnecting: false, error: null }, models: [{ slug: 'gpt-6-sol', displayName: '합성 모델' }], selectedModel: 'gpt-6-sol', setSelectedModel: vi.fn(), supportsWebSearch: true, searchWeb: vi.fn(async () => result), generateText: vi.fn(async () => '소개정보 검토') });
const callbacks = () => ({ onClose: vi.fn(), onOpenSettings: vi.fn(), onOpenUrl: vi.fn(async () => {}), onSave: vi.fn(async () => {}), onDraft: vi.fn() });
const start = () => { fireEvent.change(screen.getByLabelText('교육 주제'), { target: { value: '감염병 예방교육' } }); fireEvent.click(screen.getByRole('button', { name: '교육영상 검색' })); };
afterEach(cleanup);
describe('AI Finder explicit outbound workflow', () => {
 it('does not call AI before explicit confirmation; displays evidence and hands off draft', async () => {
  const c = connection(); const p = callbacks(); render(<AiVideoFinder connection={c} {...p} />);
  start(); expect(c.searchWeb).not.toHaveBeenCalled(); expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '확인 후 전송' }));
  await screen.findByRole('heading', { name: '합성 교육영상' }); expect(c.searchWeb).toHaveBeenCalledTimes(1);
  expect(screen.getByText('https://www.youtube.com/watch?v=abcdefghijk')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'AI로 소개정보 검토' })); expect(c.generateText).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '확인 후 전송' })); await screen.findByText('소개정보 검토');
  fireEvent.click(screen.getByRole('button', { name: '기안 초안으로 연결' })); expect(p.onDraft).toHaveBeenCalledWith(expect.objectContaining({ workName: '감염병 예방교육', target: '초등학생' }));
  fireEvent.click(screen.getByRole('button', { name: '라이브러리 저장' })); await waitFor(() => expect(p.onSave).toHaveBeenCalledTimes(1));
 });
 it('cancel never sends and sensitive prompt stays blocked', () => {
  const c = connection(); render(<AiVideoFinder connection={c} {...callbacks()} />); start();
  fireEvent.click(screen.getByRole('button', { name: '취소' })); expect(c.searchWeb).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('교육 주제'), { target: { value: '학생명: 홍길동' } });
  fireEvent.click(screen.getByRole('button', { name: '교육영상 검색' })); expect(screen.queryByRole('dialog')).toBeNull(); expect(c.searchWeb).not.toHaveBeenCalled();
 });
 it('keeps manual URL, saving and draft available without web search', async () => {
  const c = { ...connection(), supportsWebSearch: false }; const p = callbacks(); render(<AiVideoFinder connection={c} {...p} />);
  fireEvent.change(screen.getByLabelText('YouTube 영상 URL 여러 개'), { target: { value: 'https://youtu.be/abcdefghijk' } });
  fireEvent.click(screen.getByRole('button', { name: '유효한 영상 추가' }));
  fireEvent.click(screen.getByRole('button', { name: '라이브러리 저장' })); await waitFor(() => expect(p.onSave).toHaveBeenCalledTimes(1));
  expect(p.onSave).toHaveBeenCalledWith(expect.objectContaining({provenance:'teacher-supplied',metadataVerification:{title:'unverified',publisher:'unverified',durationSeconds:'unverified'}}),expect.anything());
  fireEvent.click(screen.getByRole('button', { name: '기안 초안으로 연결' })); expect(p.onDraft).toHaveBeenCalledTimes(1); expect(c.searchWeb).not.toHaveBeenCalled();
 });
 it('adds multiple teacher URLs with partial success and deduplicates current results', () => {
  const p = callbacks(); render(<AiVideoFinder connection={{ ...connection(), supportsWebSearch: false }} {...p} />);
  fireEvent.change(screen.getByLabelText('YouTube 영상 URL 여러 개'), { target: { value: [
    'https://youtu.be/abcdefghijk',
    'https://example.com/not-youtube',
    'https://www.youtube.com/shorts/lmnopqrstuv',
    'https://www.youtube.com/watch?v=abcdefghijk',
  ].join('\n') } });
  fireEvent.click(screen.getByRole('button', { name: '유효한 영상 추가' }));
  expect(screen.getByText('2개')).toBeTruthy();
  expect(screen.getByText(/2번 줄/)).toBeTruthy();
  expect(screen.getByText(/4번 줄/)).toBeTruthy();
  expect(screen.getAllByText('확인 필요').length).toBeGreaterThan(1);
  expect(screen.getAllByText(/교사 입력/).length).toBe(2);
  expect(screen.getAllByText('영상 정보 · 원문 확인 필요').length).toBe(2);
  expect(screen.queryByText('공개 소개정보의 AI 요약 · 원문 확인 필요')).toBeNull();
 });
 it('confirms the external YouTube query and copies its URL after open failure', async () => {
  const p = { ...callbacks(), onOpenUrl: vi.fn(async () => { throw new Error('synthetic open failure'); }) };
  const writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<AiVideoFinder connection={connection()} {...p} />);
  fireEvent.change(screen.getByLabelText('교육 주제'), { target: { value: '감염병 예방' } });
  expect(screen.getByText(/감염병 예방 초등학생 교육 영상 10분 공공기관 교육기관/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'YouTube에서 검색' }));
  expect(screen.getByRole('dialog', { name: 'YouTube 검색 확인' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '검색 페이지 열기' }));
  await screen.findByRole('button', { name: '검색 URL 복사' });
  fireEvent.click(screen.getByRole('button', { name: '검색 URL 복사' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/www\.youtube\.com\/results\?/)));
 });
 it.each(['searchNotPerformed','invalidResponse','reauthenticationRequired','accessDenied','usageLimitExceeded','usageUnavailable','rateLimited','temporaryFailure'] as const)('shows fallback actions for %s without presenting success', async code => {
  const c = { ...connection(), searchWeb: vi.fn(async () => { throw { code }; }) };
  render(<AiVideoFinder connection={c} {...callbacks()} />); start();
  fireEvent.click(screen.getByRole('button', { name: '확인 후 전송' }));
  await screen.findByRole('button', { name: 'YouTube에서 검색' });
  expect(screen.getByText(/영상 링크 여러 개 붙여넣기/)).toBeTruthy();
  expect(screen.getByRole('button', { name: '검색 조건 수정' })).toBeTruthy();
  expect(screen.queryByText(/후보를 찾았습니다/)).toBeNull();
 });
 it('preserves teacher-supplied candidates when a later AI search fails', async () => {
  const c = { ...connection(), searchWeb: vi.fn(async () => { throw { code: 'invalidResponse' }; }) };
  render(<AiVideoFinder connection={c} {...callbacks()} />);
  fireEvent.change(screen.getByLabelText('YouTube 영상 URL 여러 개'), { target: { value: 'https://youtu.be/abcdefghijk' } });
  fireEvent.click(screen.getByRole('button', { name: '유효한 영상 추가' }));
  start();
  fireEvent.click(screen.getByRole('button', { name: '확인 후 전송' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('응답을 확인할 수 없습니다'));
  expect(screen.getByText('https://www.youtube.com/watch?v=abcdefghijk')).toBeTruthy();
  expect(screen.getByRole('button', { name: '기안 초안으로 연결' })).toBeTruthy();
 });
 it('keeps a distinct failure message when three teacher candidates remain', async () => {
  const c = { ...connection(), searchWeb: vi.fn(async () => { throw { code: 'searchNotPerformed' }; }) };
  render(<AiVideoFinder connection={c} {...callbacks()} />);
  fireEvent.change(screen.getByLabelText('YouTube 영상 URL 여러 개'), { target: { value: ['abcdefghijk','lmnopqrstuv','zyxwvutsrqp'].map(id => `https://youtu.be/${id}`).join('\n') } });
  fireEvent.click(screen.getByRole('button', { name: '유효한 영상 추가' }));
  start();
  fireEvent.click(screen.getByRole('button', { name: '확인 후 전송' }));
  await screen.findByText(/AI 검색을 완료하지 못했지만 현재 후보 3개/);
  expect(screen.queryByText(/후보가 3개 미만/)).toBeNull();
 });
 it('keeps each candidate bound to the conditions used when it was added', async () => {
  const p = callbacks();
  render(<AiVideoFinder connection={{ ...connection(), supportsWebSearch: false }} {...p} />);
  fireEvent.change(screen.getByLabelText('교육 주제'), { target: { value: '감염병 예방교육' } });
  fireEvent.change(screen.getByLabelText('YouTube 영상 URL 여러 개'), { target: { value: 'https://youtu.be/abcdefghijk' } });
  fireEvent.click(screen.getByRole('button', { name: '유효한 영상 추가' }));
  fireEvent.change(screen.getByLabelText('교육 주제'), { target: { value: '응급처치교육' } });
  fireEvent.change(screen.getByLabelText('교육 대상'), { target: { value: '고등학생' } });
  fireEvent.change(screen.getByLabelText('YouTube 영상 URL 여러 개'), { target: { value: 'https://youtu.be/lmnopqrstuv' } });
  fireEvent.click(screen.getByRole('button', { name: '유효한 영상 추가' }));
  fireEvent.click(screen.getAllByRole('button', { name: '라이브러리 저장' })[0]);
  await waitFor(() => expect(p.onSave).toHaveBeenCalledWith(expect.objectContaining({ videoId: 'abcdefghijk' }), expect.objectContaining({ topic: '감염병 예방교육', target: '초등학생' })));
  fireEvent.click(screen.getAllByRole('button', { name: '기안 초안으로 연결' })[0]);
  expect(p.onDraft).toHaveBeenCalledWith(expect.objectContaining({ workName: '감염병 예방교육', target: '초등학생' }));
 });
 it('keeps one or two verified candidates usable and offers fallback search', async () => {
  const c = connection(); render(<AiVideoFinder connection={c} {...callbacks()} />); start();
  fireEvent.click(screen.getByRole('button', { name: '확인 후 전송' }));
  await screen.findByRole('heading', { name: '합성 교육영상' });
  expect(screen.getByText(/후보가 3개 미만이어도 선택해 계속 진행할 수 있습니다/)).toBeTruthy();
  expect(screen.getByRole('button', { name: '기안 초안으로 연결' })).toBeTruthy();
 });
 it('preserves a teacher-confirmed duplicate over a later AI result', async () => {
  const confirmed = {
   videoId: 'abcdefghijk', url: 'https://www.youtube.com/watch?v=abcdefghijk', title: '교사가 확인한 제목', publisher: '확인 기관', durationSeconds: 600,
   description: '교사 메모', relevance: '교사 확인', reason: '교사 확인', sources: result.sources, checkedAt: result.checkedAt, needsReview: true as const,
   provenance: 'teacher-confirmed' as const,
   metadataVerification: { title: 'teacher-confirmed' as const, publisher: 'teacher-confirmed' as const, durationSeconds: 'teacher-confirmed' as const },
  };
  const c = connection();
  render(<AiVideoFinder connection={c} {...callbacks()} saved={[{ candidate: confirmed, conditions: { topic: '기존 교육', target: '중학생', minutes: 10, publicFirst: true } }]} />);
  fireEvent.click(screen.getByRole('button', { name: '교사가 확인한 제목' }));
  start();
  fireEvent.click(screen.getByRole('button', { name: '확인 후 전송' }));
  await waitFor(() => expect(c.searchWeb).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('heading', { name: '교사가 확인한 제목' })).toBeTruthy();
  expect(screen.getByText(/영상 후보 · 교사 확인/)).toBeTruthy();
  expect(screen.queryByRole('heading', { name: '합성 교육영상' })).toBeNull();
 });
 it('refreshes candidate conditions when the same video returns in a later AI search', async () => {
  const p = callbacks(); const c = connection();
  render(<AiVideoFinder connection={c} {...p} />);
  start();
  fireEvent.click(screen.getByRole('button', { name: '확인 후 전송' }));
  await screen.findByRole('heading', { name: '합성 교육영상' });
  fireEvent.change(screen.getByLabelText('교육 주제'), { target: { value: '응급처치교육' } });
  fireEvent.change(screen.getByLabelText('교육 대상'), { target: { value: '고등학생' } });
  fireEvent.click(screen.getByRole('button', { name: '교육영상 검색' }));
  fireEvent.click(screen.getByRole('button', { name: '확인 후 전송' }));
  await waitFor(() => expect(c.searchWeb).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('button', { name: '라이브러리 저장' }));
  await waitFor(() => expect(p.onSave).toHaveBeenLastCalledWith(expect.objectContaining({ videoId: 'abcdefghijk' }), expect.objectContaining({ topic: '응급처치교육', target: '고등학생' })));
  fireEvent.click(screen.getByRole('button', { name: '기안 초안으로 연결' }));
  expect(p.onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ workName: '응급처치교육', target: '고등학생' }));
 });
 it('removes only the selected candidate and supports six or more teacher candidates', () => {
  render(<AiVideoFinder connection={{ ...connection(), supportsWebSearch: false }} {...callbacks()} />);
  const ids = ['abcdefghijk','lmnopqrstuv','zyxwvutsrqp','aaaabbbbccc','ddddeeeefff','gggghhhhiii'];
  fireEvent.change(screen.getByLabelText('YouTube 영상 URL 여러 개'), { target: { value: ids.map(id => `https://youtu.be/${id}`).join('\n') } });
  fireEvent.click(screen.getByRole('button', { name: '유효한 영상 추가' }));
  expect(screen.getByText('6개')).toBeTruthy();
  fireEvent.click(screen.getAllByRole('button', { name: '후보 삭제' })[0]);
  expect(screen.getByText('5개')).toBeTruthy();
 });
 it('discards pending search if account or permission changes', async () => {
  let resolve: ((result: WebSearchResult) => void) | undefined;
  const c = { ...connection(), searchWeb: vi.fn(() => new Promise<WebSearchResult>(done => { resolve = done; })) }; const p = callbacks();
  const view = render(<AiVideoFinder connection={c} {...p} />); start(); fireEvent.click(screen.getByRole('button', { name: '확인 후 전송' }));
  view.rerender(<AiVideoFinder connection={{ ...c, supportsWebSearch: false, state: { ...c.state, planUsageEnabled: false } }} {...p} />);
  resolve?.(result); await waitFor(() => expect(screen.queryByRole('heading', { name: '합성 교육영상' })).toBeNull());
 });
 it('cancels pending confirmation on model change and preserves safe failure', async () => {
  const c = connection(); const p = callbacks(); const view = render(<AiVideoFinder connection={c} {...p} />); start();
  view.rerender(<AiVideoFinder connection={{ ...c, selectedModel: 'other-model' }} {...p} />); expect(screen.queryByRole('dialog')).toBeNull(); expect(c.searchWeb).not.toHaveBeenCalled();
  view.rerender(<AiVideoFinder connection={{ ...c, searchWeb: vi.fn(async () => { throw new Error('synthetic failure'); }) }} {...p} />); start(); fireEvent.click(screen.getByRole('button', { name: '확인 후 전송' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('ChatGPT')); expect(screen.queryByRole('heading', { name: '합성 교육영상' })).toBeNull();
 });
 it('loads saved topic and target instead of assigning current search conditions', () => {
  const candidate = { videoId: 'abcdefghijk', url: 'https://www.youtube.com/watch?v=abcdefghijk', title: '저장 영상', publisher: null, durationSeconds: null, description: '소개', relevance: '관련', reason: '확인', sources: result.sources, checkedAt: result.checkedAt, needsReview: true as const, provenance: 'unverified' as const, metadataVerification: { title: 'unverified' as const, publisher: 'unverified' as const, durationSeconds: 'unverified' as const } };
  const p = callbacks(); render(<AiVideoFinder connection={connection()} {...p} saved={[{ candidate, conditions: { topic: '저장된 교육', target: '고등학생', minutes: null, publicFirst: true } }]} />);
  fireEvent.click(screen.getByRole('button', { name: '저장 영상' })); fireEvent.click(screen.getByRole('button', { name: '기안 초안으로 연결' })); expect(p.onDraft).toHaveBeenCalledWith(expect.objectContaining({ workName: '저장된 교육', target: '고등학생' }));
 });
});

it('keeps the captured request when visible conditions change during an offline pending search', async () => {
 let finish: ((value: WebSearchResult) => void) | undefined;
 const c = { ...connection(), searchWeb: vi.fn(() => new Promise<WebSearchResult>(resolve => { finish = resolve; })) };
 render(<AiVideoFinder connection={c} {...callbacks()} />);
 fireEvent.change(screen.getByLabelText('교육 주제'), { target: { value: '마약류 예방교육' } });
 fireEvent.change(screen.getByLabelText('교육 대상'), { target: { value: '고등학생' } });
 fireEvent.change(screen.getByLabelText('희망 영상 길이'), { target: { value: '20' } });
 fireEvent.click(screen.getByRole('button', { name: '교육영상 검색' }));
 fireEvent.click(screen.getByRole('button', { name: '확인 후 전송' }));
 await waitFor(() => expect(c.searchWeb).toHaveBeenCalledTimes(1));
 fireEvent.change(screen.getByLabelText('교육 주제'), { target: { value: '양성평등교육' } });
 expect(c.searchWeb).toHaveBeenCalledWith(expect.stringContaining('주제: 마약류 예방교육 / 대상: 고등학생 / 희망 길이: 20분 내외'));
 expect(screen.getByLabelText('교육 주제')).toHaveProperty('value', '양성평등교육');
 finish?.(result);
 await screen.findByRole('heading', { name: '합성 교육영상' });
});

it('sends the edited confirmation prompt rather than regenerating it from displayed conditions', async () => {
 const c = connection(); render(<AiVideoFinder connection={c} {...callbacks()} />); start();
 const editor = screen.getByLabelText('AI 서비스로 전송될 내용');
 const edited = '합성 공개 자료 요청: 마약류 예방교육 / 고등학생 / 20분 / 공공기관 우선';
 fireEvent.change(editor, { target: { value: edited } });
 fireEvent.click(screen.getByRole('button', { name: '확인 후 전송' }));
 await waitFor(() => expect(c.searchWeb).toHaveBeenCalledWith(edited));
});
