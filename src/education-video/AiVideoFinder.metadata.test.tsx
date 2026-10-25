// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiVideoFinder, type AiFinderConnection } from './AiVideoFinder';
import type { AiVideoCandidate } from './aiVideo';

const connection = (): AiFinderConnection => ({
  state: { status: 'connected', email: 'synthetic@example.test', displayName: '합성 계정', planUsageEnabled: true, clientRegistrationExists: true, showPlanUsageNotice: false, notice: null, isLoading: false, isSigningIn: false, isDisconnecting: false, error: null },
  models: [{ slug: 'gpt-6-sol', displayName: '합성 모델' }],
  selectedModel: 'gpt-6-sol', setSelectedModel: vi.fn(), supportsWebSearch: false,
  searchWeb: vi.fn(), generateText: vi.fn(),
});
const callbacks = () => ({ onClose: vi.fn(), onOpenSettings: vi.fn(), onOpenUrl: vi.fn(async () => {}), onSave: vi.fn(async () => {}), onDraft: vi.fn() });
const savedCandidate: AiVideoCandidate = {
  videoId: 'abcdefghijk', url: 'https://www.youtube.com/watch?v=abcdefghijk', title: '저장된 확인 제목', publisher: '저장된 확인 기관', durationSeconds: 570,
  description: '', relevance: '', reason: '', sources: [{ url: 'https://www.youtube.com/watch?v=abcdefghijk', title: '교사 입력 URL' }], checkedAt: '2026-10-26T00:00:00.000Z', needsReview: true,
  provenance: 'teacher-supplied', metadataVerification: { title: 'teacher-confirmed', publisher: 'teacher-confirmed', durationSeconds: 'teacher-confirmed' },
};
const saved = [{ candidate: savedCandidate, conditions: { topic: '감염병 예방교육', target: '초등학생', minutes: 10, publicFirst: true } }] as const;

afterEach(cleanup);

describe('AI Finder teacher-confirmed metadata', () => {
  it('confirms only entered facts before save and draft handoff', async () => {
    const p = callbacks();
    render(<AiVideoFinder connection={connection()} {...p} />);
    fireEvent.change(screen.getByLabelText('교육 주제'), { target: { value: '감염병 예방교육' } });
    fireEvent.change(screen.getByLabelText('YouTube 영상 URL 여러 개'), { target: { value: 'https://youtu.be/abcdefghijk' } });
    fireEvent.click(screen.getByRole('button', { name: '유효한 영상 추가' }));
    fireEvent.change(screen.getByLabelText('확인한 영상 제목'), { target: { value: '교사가 확인한 손씻기 영상' } });
    fireEvent.change(screen.getByLabelText('확인한 제작기관'), { target: { value: '공공 보건기관' } });
    fireEvent.change(screen.getByLabelText('재생시간 분'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('재생시간 초'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: '확인한 정보 적용' }));
    expect(screen.getByRole('heading', { name: '교사가 확인한 손씻기 영상' })).toBeTruthy();
    expect(screen.getAllByText('교사 확인')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '라이브러리 저장' }));
    await waitFor(() => expect(p.onSave).toHaveBeenCalledWith(expect.objectContaining({
      videoId: 'abcdefghijk', title: '교사가 확인한 손씻기 영상', publisher: '공공 보건기관', durationSeconds: 570,
      provenance: 'teacher-supplied', metadataVerification: { title: 'teacher-confirmed', publisher: 'teacher-confirmed', durationSeconds: 'teacher-confirmed' },
    }), expect.anything()));
    fireEvent.click(screen.getByRole('button', { name: '기안 초안으로 연결' }));
    expect(p.onDraft).toHaveBeenCalledWith(expect.objectContaining({ organization: '공공 보건기관', mainContent: expect.stringContaining('교사 확인 재생시간: 9분 30초') }));
  });

  it('keeps omitted facts unverified', () => {
    const p = callbacks();
    render(<AiVideoFinder connection={connection()} {...p} />);
    fireEvent.change(screen.getByLabelText('YouTube 영상 URL 여러 개'), { target: { value: 'https://youtu.be/abcdefghijk' } });
    fireEvent.click(screen.getByRole('button', { name: '유효한 영상 추가' }));
    fireEvent.change(screen.getByLabelText('확인한 영상 제목'), { target: { value: '확인한 제목' } });
    fireEvent.click(screen.getByRole('button', { name: '확인한 정보 적용' }));
    fireEvent.click(screen.getByRole('button', { name: '기안 초안으로 연결' }));
    expect(p.onDraft).toHaveBeenCalledWith(expect.objectContaining({ organization: '', mainContent: expect.not.stringContaining('확인된 제작기관') }));
    expect(screen.getAllByText('확인 필요').length).toBeGreaterThanOrEqual(2);
  });

  it('preserves existing confirmed facts when a saved field is left blank', () => {
    const p = callbacks();
    render(<AiVideoFinder connection={connection()} {...p} saved={saved} />);
    fireEvent.click(screen.getByRole('button', { name: '저장된 확인 제목' }));
    fireEvent.change(screen.getByLabelText('확인한 제작기관'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '확인한 정보 적용' }));
    fireEvent.click(screen.getByRole('button', { name: '라이브러리 저장' }));
    expect(p.onSave).toHaveBeenCalledWith(expect.objectContaining({
      publisher: '저장된 확인 기관', metadataVerification: expect.objectContaining({ publisher: 'teacher-confirmed' }),
    }), expect.anything());
  });

  it('resets draft editor values when a saved candidate replaces the same video ID', () => {
    render(<AiVideoFinder connection={connection()} {...callbacks()} saved={saved} />);
    fireEvent.change(screen.getByLabelText('YouTube 영상 URL 여러 개'), { target: { value: savedCandidate.url } });
    fireEvent.click(screen.getByRole('button', { name: '유효한 영상 추가' }));
    fireEvent.change(screen.getByLabelText('확인한 영상 제목'), { target: { value: '적용하지 않은 임시 제목' } });
    fireEvent.click(screen.getByRole('button', { name: '저장된 확인 제목' }));
    expect((screen.getByLabelText('확인한 영상 제목') as HTMLInputElement).value).toBe('저장된 확인 제목');
    expect((screen.getByLabelText('확인한 제작기관') as HTMLInputElement).value).toBe('저장된 확인 기관');
  });

  it('rejects a duration above the library v2 24-hour limit', () => {
    const p = callbacks();
    render(<AiVideoFinder connection={connection()} {...p} />);
    fireEvent.change(screen.getByLabelText('YouTube 영상 URL 여러 개'), { target: { value: savedCandidate.url } });
    fireEvent.click(screen.getByRole('button', { name: '유효한 영상 추가' }));
    fireEvent.change(screen.getByLabelText('재생시간 분'), { target: { value: '1440' } });
    fireEvent.change(screen.getByLabelText('재생시간 초'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: '확인한 정보 적용' }));
    expect(screen.getByRole('alert').textContent).toContain('재생시간은 1초 이상 24시간 이하여야 합니다.');
    fireEvent.click(screen.getByRole('button', { name: '라이브러리 저장' }));
    expect(p.onSave).toHaveBeenCalledWith(expect.objectContaining({ durationSeconds: null }), expect.anything());
  });
});
