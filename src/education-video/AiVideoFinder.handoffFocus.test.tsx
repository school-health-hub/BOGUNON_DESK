// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiVideoFinder, type AiFinderConnection } from './AiVideoFinder';
const connection: AiFinderConnection = { state: { status: 'disconnected', email: null, displayName: null, planUsageEnabled: false, clientRegistrationExists: false, showPlanUsageNotice: false, notice: null, isLoading: false, isSigningIn: false, isDisconnecting: false, error: null }, models: [], selectedModel: null, setSelectedModel: vi.fn(), supportsWebSearch: false, searchWeb: vi.fn(), generateText: vi.fn() };
function setup(onOpenUrl = vi.fn(async () => {})) {
 render(<div><nav aria-label="영상 Finder 방식"><button>합성 방식 변경</button></nav><section inert ref={element => { element?.setAttribute('inert', 'preserved'); }} data-testid="previous-inert">합성 기존 비활성 영역</section><AiVideoFinder connection={connection} onClose={vi.fn()} onOpenSettings={vi.fn()} onOpenUrl={onOpenUrl} onSave={vi.fn()} onDraft={vi.fn()} /></div>);
 fireEvent.change(screen.getByLabelText('교육 주제'), { target: { value: '합성 예방교육' } });
 const trigger = screen.getByRole('button', { name: 'YouTube에서 영상 찾기' });
 trigger.focus();
 fireEvent.click(trigger);
 return { trigger, dialog: screen.getByRole('dialog', { name: 'YouTube 검색 확인' }) };
}
afterEach(cleanup);
describe('YouTube handoff keyboard confirmation', () => {
 it('focuses cancel and isolates the search controls when opened', async () => {
  const { dialog } = setup();
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '취소' })));
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  expect(screen.getByLabelText('교육 주제').closest('[inert]')).not.toBeNull();
  expect(dialog.closest('[inert]')).toBeNull();
 });
 it('isolates ancestor navigation and preserves preexisting inert state after unmount', () => {
  const { dialog } = setup();
  const navigation = screen.getByRole('navigation', { name: '영상 Finder 방식' });
  const previousInert = screen.getByTestId('previous-inert');
  expect(navigation.closest('[inert]')).not.toBeNull();
  expect(dialog.closest('[inert]')).toBeNull();
  cleanup();
  expect(navigation.hasAttribute('inert')).toBe(false);
  expect(previousInert.getAttribute('inert')).toBe('preserved');
  expect(document.body.hasAttribute('inert')).toBe(false);
 });
 it('restores ancestor navigation without clearing an existing inert attribute', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: '취소' }));
  expect(screen.getByRole('navigation', { name: '영상 Finder 방식' }).closest('[inert]')).toBeNull();
  expect(screen.getByTestId('previous-inert').getAttribute('inert')).toBe('preserved');
 });
 it.each([false, true])('wraps Tab at the %s reverse boundary', async reverse => {
  const { dialog } = setup();
  const first = within(dialog).getByRole('button', { name: '취소' });
  const last = within(dialog).getByRole('button', { name: '검색 페이지 열기' });
  await waitFor(() => expect(document.activeElement).toBe(first));
  (reverse ? first : last).focus();
  fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Tab', shiftKey: reverse });
  expect(document.activeElement).toBe(reverse ? last : first);
 });
 it.each(['cancel', 'escape', 'success'] as const)('restores the original trigger after %s', async close => {
  const { trigger, dialog } = setup();
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '취소' })));
  switch (close) {
   case 'cancel': fireEvent.click(within(dialog).getByRole('button', { name: '취소' })); break;
   case 'escape': fireEvent.keyDown(dialog, { key: 'Escape' }); break;
   case 'success': fireEvent.click(within(dialog).getByRole('button', { name: '검색 페이지 열기' })); break;
  }
  await waitFor(() => {
   expect(screen.queryByRole('dialog')).toBeNull();
   expect(trigger.isConnected).toBe(true);
   expect(document.activeElement).toBe(trigger);
   expect(trigger.closest('[inert]')).toBeNull();
  }, { timeout: 1000 });
 });
 it('keeps failed opening inside the dialog and traps the new copy fallback', async () => {
  const { dialog } = setup(vi.fn(async () => { throw new Error('synthetic browser failure'); }));
  fireEvent.click(within(dialog).getByRole('button', { name: '검색 페이지 열기' }));
  const copy = await within(dialog).findByRole('button', { name: '검색 URL 복사' });
  copy.focus();
  fireEvent.keyDown(copy, { key: 'Tab' });
  expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '취소' }));
  expect(screen.getByLabelText('교육 주제').closest('[inert]')).not.toBeNull();
 });
});
