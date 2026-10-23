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
  fireEvent.change(screen.getByLabelText('YouTube 영상 URL'), { target: { value: 'https://youtu.be/abcdefghijk' } });
  fireEvent.click(screen.getByRole('button', { name: 'URL 확인 후 추가' }));
  fireEvent.click(screen.getByRole('button', { name: '라이브러리 저장' })); await waitFor(() => expect(p.onSave).toHaveBeenCalledTimes(1));
  expect(p.onSave).toHaveBeenCalledWith(expect.objectContaining({provenance:'teacher-supplied',metadataVerification:{title:'unverified',publisher:'unverified',durationSeconds:'unverified'}}),expect.anything());
  fireEvent.click(screen.getByRole('button', { name: '기안 초안으로 연결' })); expect(p.onDraft).toHaveBeenCalledTimes(1); expect(c.searchWeb).not.toHaveBeenCalled();
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
