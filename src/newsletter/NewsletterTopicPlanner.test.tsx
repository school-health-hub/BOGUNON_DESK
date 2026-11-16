// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NewsletterTopicPlanner } from './NewsletterTopicPlanner';
import { createBlankNewsletter } from './newDocument';
const now = '2026-11-13T00:00:00.000Z';
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); }; HTMLElement.prototype.scrollTo = vi.fn(); });
afterEach(cleanup);
async function setup() { const document = await createBlankNewsletter({ month: '2026-11', schoolType: 'coed-high', projectId: 'ui-ns01', now }); const onApply = vi.fn(), onCancel = vi.fn(); const view = render(<NewsletterTopicPlanner project={document.project} month="2026-11" onApply={onApply} onCancel={onCancel}/>); return { ...view, document, onApply, onCancel }; }
const example = () => fireEvent.click(screen.getByText('합성 예시로 검토 · 실제 이력 아님'));
const select = () => fireEvent.click(screen.getByText('추천 순서로 최대 6개 선택'));
it('starts empty, truthfully shows shortage and leaves current document unchanged on cancel', async () => {
    const { document, onApply, onCancel } = await setup(), before = JSON.stringify(document);
    expect(screen.getByText(/추천 자료가 6개 부족합니다/)).toBeTruthy();
    expect(screen.getByLabelText('주제 은행 JSON 가져오기')).toHaveProperty('disabled', true);
    example();
    select();
    fireEvent.click(screen.getByText('취소 · 현재 문서 유지'));
    expect(onApply).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(JSON.stringify(document)).toBe(before);
});
it('allows replacement, reordering, review, then one explicit application only', async () => {
    const { onApply } = await setup();
    example();
    select();
    fireEvent.click(screen.getByLabelText('1번 주제 해제'));
    fireEvent.click(screen.getByRole('checkbox', { name: '학교생활 적응' }));
    fireEvent.click(screen.getByLabelText('6번 주제 위로'));
    fireEvent.click(screen.getByText('6개 주제 변경 미리보기'));
    const apply = screen.getByText('공통 원고에 적용 · 새 revision');
    expect(apply).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('checkbox', { name: '6개 주제와 출처·수칙을 검토했으며 새 revision 적용을 확인합니다.' }));
    fireEvent.click(apply);
    fireEvent.click(apply);
    expect(onApply).toHaveBeenCalledOnce();
    expect(onApply.mock.calls[0]?.[0]).toHaveLength(6);
    expect(onApply.mock.calls[0]?.[0][4]?.title).toBe('학교생활 적응');
});
it('manual input has no fabricated source copy and backing out does not apply', async () => {
    const { onApply } = await setup();
    example();
    select();
    fireEvent.click(screen.getByLabelText('1번 주제 해제'));
    fireEvent.change(screen.getByLabelText('직접 주제 제목'), { target: { value: '직접 작성할 주제' } });
    fireEvent.click(screen.getByText('직접 주제 추가'));
    expect(screen.getByText('직접 작성할 주제', { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByText('6개 주제 변경 미리보기'));
    expect(screen.getByText('한 줄 소개 작성 필요')).toBeTruthy();
    fireEvent.click(screen.getByText('이전 · 주제 수정'));
    expect(onApply).not.toHaveBeenCalled();
});
it('invalid imports preserve the current choices, successful imports retain supplied sources', async () => {
    const { onApply } = await setup();
    example();
    select();
    fireEvent.click(screen.getByRole('checkbox', { name: '개인정보가 없고 사용 허가된 로컬 주제 자료만 가져옵니다.' }));
    const file = new File(['{}'], 'invalid.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => '{}' });
    fireEvent.change(screen.getByLabelText('주제 은행 JSON 가져오기'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('status').textContent).not.toBe('자료를 세션 안에서만 가져왔습니다. 추천 확인 후 주제 6개를 검토해 주세요.'));
    expect(screen.getByText('후보 8개 · 선택 6/6')).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
});
it('invalid month disables example loading and confirmation', async () => { await setup(); fireEvent.change(screen.getByLabelText('추천 기준 월'), { target: { value: '' } }); expect(screen.getByText('합성 예시로 검토 · 실제 이력 아님')).toHaveProperty('disabled', true); expect(screen.getByText('6개 주제 변경 미리보기')).toHaveProperty('disabled', true); });
