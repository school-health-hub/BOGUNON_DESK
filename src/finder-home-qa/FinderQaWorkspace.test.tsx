// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfficialDocumentSessionProvider } from '../official-document/OfficialDocumentSessionContext';
import { libraryRepository } from '../education-video/library';
import { FinderQaWorkspace } from './FinderQaWorkspace';
import { syntheticCandidate } from './syntheticFixture';

vi.mock('../ai/AiConnectionContext', async () => import('./inertConnections'));
vi.mock('../chatgpt/ChatGptConnectionContext', async () => import('./inertConnections'));

const renderWorkspace = () => render(<OfficialDocumentSessionProvider><FinderQaWorkspace /></OfficialDocumentSessionProvider>);
const selectSynthetic = async () => fireEvent.click(await screen.findByRole('button', { name: syntheticCandidate.title }));
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('isolated Finder QA component flow', () => {
  it('shows the same recovery notice only when the isolated repository reports a successful recovery', async () => {
    vi.spyOn(libraryRepository, 'load').mockResolvedValue({ library: { version: 2, entries: [] }, recovered: true });
    renderWorkspace();
    expect(await screen.findByText('저장된 교육영상 목록에 문제가 발견되어 백업에서 복구했습니다. 현재 목록을 확인해 주세요.')).toBeTruthy();
    expect(libraryRepository.load).toHaveBeenCalledTimes(1);
  });
  it('keeps the recovery notice after an explicit QA backup recovery', async () => {
    vi.spyOn(libraryRepository, 'recover').mockResolvedValue({ library: { version: 2, entries: [] }, recovered: true });
    renderWorkspace();
    fireEvent.click(await screen.findByRole('button', { name: 'QA 백업 복구' }));
    expect(await screen.findByText('저장된 교육영상 목록에 문제가 발견되어 백업에서 복구했습니다. 현재 목록을 확인해 주세요.')).toBeTruthy();
  });
  it('hands a synthetic candidate to the actual official document panel without AI', async () => {
    // Given an isolated workspace with the existing Finder component.
    renderWorkspace(); await selectSynthetic();
    // When the teacher connects the selected candidate to the draft screen.
    fireEvent.click(screen.getByRole('button', { name: '기안 초안으로 연결' }));
    // Then the real document form contains only the supplied condition and URL.
    expect(screen.getByRole('button', { name: 'QA Finder로 돌아가기' })).toBeTruthy();
    expect(screen.getByDisplayValue('합성 마약류 예방교육')).toBeTruthy();
    expect(screen.getByDisplayValue(/https:\/\/www.youtube.com\/watch\?v=QAoffline01/)).toBeTruthy();
    expect(screen.queryByText('계정 연결됨')).toBeNull();
  });

  it('preserves a saved memo across duplicate saves and component reload', async () => {
    // Given a saved synthetic candidate and a teacher memo.
    const first = renderWorkspace(); await selectSynthetic();
    fireEvent.click(screen.getByRole('button', { name: '라이브러리 저장' }));
    const memo = await screen.findByLabelText('QAoffline01 QA 메모');
    fireEvent.change(memo, { target: { value: '합성 QA 메모' } });
    fireEvent.click(screen.getByRole('button', { name: 'QA 메모 저장' }));
    await waitFor(async () => expect((await libraryRepository.load()).library.entries[0]?.teacher.notes).toBe('합성 QA 메모'));
    // When the same candidate is saved again and the component is remounted.
    fireEvent.click(screen.getByRole('button', { name: '라이브러리 저장' }));
    await waitFor(async () => expect((await libraryRepository.load()).library.entries).toHaveLength(1));
    first.unmount(); renderWorkspace();
    // Then a single entry retains the memo.
    await waitFor(() => expect(screen.getByDisplayValue('합성 QA 메모')).toBeTruthy());
    expect((await libraryRepository.load()).library.entries).toHaveLength(1);
  });

  it('rejects an unsafe URL before it becomes a candidate', async () => {
    // Given the real URL registration control.
    renderWorkspace();
    fireEvent.change(screen.getByLabelText('YouTube 영상 URL 여러 개'), { target: { value: 'https://malicious.example/watch?v=QAoffline01' } });
    // When the teacher tries to add an unsupported URL.
    fireEvent.click(screen.getByRole('button', { name: '유효한 영상 추가' }));
    // Then no candidate card or library entry is created.
    expect(screen.getByRole('list', { name: 'URL 입력 오류' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '라이브러리 저장' })).toBeNull();
    expect((await libraryRepository.load()).library.entries).toHaveLength(0);
  });

  it('keeps AI search unavailable while the local draft workflow is available', async () => {
    // Given an isolated workspace and a selected synthetic candidate.
    renderWorkspace(); await selectSynthetic();
    // When the AI settings control is activated.
    fireEvent.click(screen.getByRole('button', { name: 'AI 연결 설정' }));
    // Then the UI states the block and never offers a live search submit action.
    expect(screen.getByText('격리 QA에서는 인증·모델 조회·AI 연결이 차단됩니다.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '교육영상 검색' })).toBeNull();
    expect(screen.getByRole('button', { name: 'AI로 추천 이유 정리' }).hasAttribute('disabled')).toBe(true);
  });

  it('exports and reimports the QA JSON while retaining a single candidate', async () => {
    // Given a saved synthetic candidate.
    renderWorkspace(); await selectSynthetic();
    fireEvent.click(screen.getByRole('button', { name: '라이브러리 저장' }));
    await screen.findByLabelText('QAoffline01 QA 메모');
    fireEvent.click(screen.getByRole('button', { name: 'QA JSON 내보내기' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'QA JSON 가져오기' }).hasAttribute('disabled')).toBe(false));
    // When the exported JSON is imported.
    fireEvent.click(screen.getByRole('button', { name: 'QA JSON 가져오기' }));
    // Then the existing ID is merged rather than duplicated.
    await waitFor(() => expect(screen.getByText('QA 라이브러리 작업을 완료했습니다.')).toBeTruthy());
    expect((await libraryRepository.load()).library.entries).toHaveLength(1);
  });

  it('retains saved data after a malformed import', async () => {
    // Given a saved synthetic candidate.
    renderWorkspace(); await selectSynthetic();
    fireEvent.click(screen.getByRole('button', { name: '라이브러리 저장' }));
    await screen.findByLabelText('QAoffline01 QA 메모');
    const before = await libraryRepository.export();
    // When malformed JSON is imported.
    fireEvent.change(screen.getByLabelText('QA 라이브러리 JSON'), { target: { value: '{invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'QA JSON 가져오기' }));
    // Then the existing library is unchanged.
    await waitFor(() => expect(screen.getByText(/작업하지 못했습니다. 기존 QA 자료는 유지됩니다/)).toBeTruthy());
    expect(await libraryRepository.export()).toBe(before);
  });
});
