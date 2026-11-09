// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NewsletterOutputControls } from '../renderer/adapters/NewsletterOutputControls';
import { compatibilityFixture } from './newsletter-compatibility-fixtures';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('keeps the BrowserWindow modal until the current export settles', async () => {
  const { project, design } = await compatibilityFixture();
  let finish: (result: { ok: true; data: { saved: false } }) => void = () => {};
  const exportOutput = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal('electronWork', { newsletter: { exportOutput } });
  const view = render(<NewsletterOutputControls project={project} design={design} ready blockedReason="" />);
  const dialog = view.container.querySelector('dialog');
  expect(dialog).toBeInstanceOf(HTMLDialogElement);
  if (dialog === null) throw new Error('Output lock dialog missing');
  Object.defineProperties(dialog, {
    showModal: { value: vi.fn(() => dialog.setAttribute('open', '')) },
    close: { value: vi.fn(() => dialog.removeAttribute('open')) },
  });

  fireEvent.click(screen.getByRole('button', { name: '출력 위치 선택·저장' }));

  await waitFor(() => expect(exportOutput).toHaveBeenCalledOnce());
  expect(dialog.open).toBe(true);
  expect(fireEvent(dialog, new Event('cancel', { cancelable: true }))).toBe(false);
  finish({ ok: true, data: { saved: false } });
  await screen.findByText('출력 저장을 취소했습니다.');
  expect(dialog.open).toBe(false);
  expect(screen.getByRole('button', { name: '출력 위치 선택·저장' })).toHaveProperty('disabled', false);
});
