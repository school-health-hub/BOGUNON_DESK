// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FirstRunOnboarding } from '../renderer/FirstRunOnboarding';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('explains the workspace, keeps account connection optional, and saves the selected start mode', async () => {
  const complete = vi.fn(async () => {});
  render(<><button type="button">원래 버튼</button><FirstRunOnboarding onComplete={complete}/></>);
  expect(screen.getByRole('dialog', { name: 'BOGUNON DESK 시작 안내' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  fireEvent.click(screen.getByRole('button', { name: /^Workspace/ }));
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  expect(screen.getByText(/계정 연결은 선택 사항/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  fireEvent.click(screen.getByRole('button', { name: 'BOGUNON DESK 시작하기' }));
  await waitFor(() => expect(complete).toHaveBeenCalledWith('window', false));
});

it('opens account settings only by choice and keeps the dialog on save failure', async () => {
  const complete = vi.fn().mockRejectedValueOnce(Error('synthetic')).mockResolvedValueOnce(undefined);
  render(<FirstRunOnboarding onComplete={complete}/>);
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  fireEvent.click(screen.getByRole('button', { name: /설정에서 계정 연결하기/ }));
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
  fireEvent.click(screen.getByRole('button', { name: 'BOGUNON DESK 시작하기' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'BOGUNON DESK 시작하기' }));
  await waitFor(() => expect(complete).toHaveBeenLastCalledWith('window', true));
});

it('ESC opens the discoverable workspace instead of leaving a bare palette', async () => {
  const complete = vi.fn(async () => {});
  render(<FirstRunOnboarding onComplete={complete}/>);
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(complete).toHaveBeenCalledWith('window', false));
});
