// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OfficialDocumentSessionProvider, useOfficialDocumentSession } from '../official-document/OfficialDocumentSessionContext';
import { createOfficialDocumentSession } from '../official-document/officialDocumentSession';
import { candidateDraftInput, type AiVideoCandidate } from './aiVideo';
import { ConnectedFinder } from './ConnectedFinder';
import type { OfficialDocumentInput } from '../official-document/types';
const supabase = vi.hoisted(() => vi.fn());
const libraryLoad = vi.hoisted(() => vi.fn());
vi.mock('../auth/supabaseClient', () => ({ getSupabaseClient: supabase }));
vi.mock('../chatgpt/ChatGptConnectionContext', () => ({ useChatGptConnection: () => ({ state: { status: 'disconnected' }, models: [], selectedModel: null }) }));
vi.mock('./library', () => ({
 libraryRepository: { load: libraryLoad },
 LIBRARY_RECOVERY_NOTICE: '저장된 교육영상 목록에 문제가 발견되어 백업에서 복구했습니다. 현재 목록을 확인해 주세요.',
}));
const candidate: AiVideoCandidate = { videoId: 'abcdefghijk', url: 'https://www.youtube.com/watch?v=abcdefghijk', title: '선택한 교육영상', publisher: null, durationSeconds: null, description: '공개 소개정보', relevance: '관련', reason: '교사 확인', sources: [], checkedAt: '2026-10-22T00:00:00Z', needsReview: true, provenance: 'unverified', metadataVerification: { title: 'unverified', publisher: 'unverified', durationSeconds: 'unverified' } };
const input = candidateDraftInput(candidate, { topic: '감염병 예방교육', target: '초등학생', minutes: 10, publicFirst: true });
vi.mock('./AiVideoFinder', () => ({ AiVideoFinder: ({ onDraft }: { onDraft: (input: OfficialDocumentInput) => void }) => <button type="button" onClick={() => onDraft(input)}>합성 기안 연결</button> }));
vi.mock('../components/desktop/OfficialDocumentPanel', () => ({ OfficialDocumentPanel: () => { const { state } = useOfficialDocumentSession(); return <div><h2>실제 세션 기안</h2><p>{state.createInput.workName}</p><p>{state.createInput.mainContent}</p><p data-testid="draft">{state.draft?.body}</p><p data-testid="old-ai">{state.outputs.create.aiResponse}</p></div>; } }));
function Observer() { const { state } = useOfficialDocumentSession(); return <p data-testid="saved-topic">{state.createInput.workName}</p>; }
afterEach(() => { cleanup(); supabase.mockClear(); libraryLoad.mockReset(); });
describe('Connected Finder official document handoff', () => {
 it('shows the persistent recovery notice only after a successful automatic backup recovery', async () => {
  libraryLoad.mockResolvedValue({ library: { version: 2, entries: [] }, recovered: true });
  const view = render(<OfficialDocumentSessionProvider><ConnectedFinder onClose={() => {}} /></OfficialDocumentSessionProvider>);
  expect((await screen.findByRole('status')).textContent).toBe('저장된 교육영상 목록에 문제가 발견되어 백업에서 복구했습니다. 현재 목록을 확인해 주세요.');
  view.rerender(<OfficialDocumentSessionProvider><ConnectedFinder onClose={() => {}} /></OfficialDocumentSessionProvider>);
  await waitFor(() => expect(libraryLoad).toHaveBeenCalledTimes(1));
 });
 it('does not show a recovery success notice after a normal load or a failed load', async () => {
  libraryLoad.mockResolvedValueOnce({ library: { version: 2, entries: [] }, recovered: false });
  const normal = render(<OfficialDocumentSessionProvider><ConnectedFinder onClose={() => {}} /></OfficialDocumentSessionProvider>);
  await waitFor(() => expect(libraryLoad).toHaveBeenCalledTimes(1));
  expect(screen.queryByText(/백업에서 복구했습니다/)).toBeNull();
  normal.unmount(); libraryLoad.mockRejectedValueOnce(new Error('synthetic failure'));
  render(<OfficialDocumentSessionProvider><ConnectedFinder onClose={() => {}} /></OfficialDocumentSessionProvider>);
  expect((await screen.findByRole('status')).textContent).toBe('로컬 라이브러리를 읽지 못했습니다. 기존 파일은 유지됩니다.');
  expect(screen.queryByText(/백업에서 복구했습니다/)).toBeNull();
 });
 it('keeps AI screen independent of legacy Supabase and transfers real deterministic draft', () => {
  libraryLoad.mockResolvedValue({ library: { version: 2, entries: [] }, recovered: false });
  render(<OfficialDocumentSessionProvider><ConnectedFinder onClose={() => {}} /></OfficialDocumentSessionProvider>);
  expect(supabase).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: '합성 기안 연결' }));
  expect(screen.getByRole('heading', { name: '실제 세션 기안' })).toBeTruthy(); expect(screen.getByTestId('draft').textContent).toContain('선택한 교육영상'); expect(screen.getAllByText(/https:\/\/www.youtube.com\/watch/).length).toBeGreaterThan(0);
 });
 it('preserves existing input when cancel or Escape; confirmation replaces and clears previous AI output', () => {
  libraryLoad.mockResolvedValue({ library: { version: 2, entries: [] }, recovered: false });
  const empty = createOfficialDocumentSession(); const initial = { ...empty, createInput: { ...empty.createInput, workName: '기존 교사 초안' }, outputs: { ...empty.outputs, create: { prompt: '이전 프롬프트', aiResponse: '이전 AI 결과', reviewedOutbound: '이전 전송본' } } };
  render(<OfficialDocumentSessionProvider initialState={initial}><ConnectedFinder onClose={() => {}} /><Observer /></OfficialDocumentSessionProvider>);
  fireEvent.click(screen.getByRole('button', { name: '합성 기안 연결' })); expect(screen.getByRole('dialog')).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: '기존 초안 유지' })); expect(screen.getByTestId('saved-topic').textContent).toBe('기존 교사 초안');
  fireEvent.click(screen.getByRole('button', { name: '합성 기안 연결' })); fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '합성 기안 연결' })); fireEvent.click(screen.getByRole('button', { name: '영상으로 새 초안 작성' })); expect(screen.getByTestId('saved-topic').textContent).toBe('감염병 예방교육'); expect(screen.getByTestId('old-ai').textContent).toBe('');
 });
});
