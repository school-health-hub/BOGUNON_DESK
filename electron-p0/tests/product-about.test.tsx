// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProductAbout } from '../renderer/ProductAbout';

afterEach(() => cleanup());

it('shows the release identity while keeping machine diagnostics collapsed', () => {
  const onOpenNewsletter = vi.fn();
  render(<ProductAbout info={{
    appId: 'kr.sungandi.schoolhealthdesk.electronp0',
    productName: 'BOGUNON DESK',
    version: '2.0.0-beta.2',
    userData: 'F:/synthetic-profile',
    sourceSha: 'synthetic-source',
    electron: '45.2.1',
  }} onOpenNewsletter={onOpenNewsletter} />);

  expect(screen.getByRole('heading', { name: 'BOGUNON DESK 2.0' })).toBeTruthy();
  expect(screen.getByText('내부 베타 · 버전 2.0.0-beta.2')).toBeTruthy();
  const diagnostics = screen.getByText('고급 진단 정보').closest('details');
  expect(diagnostics?.hasAttribute('open')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '보건소식지 제작소' }));
  expect(onOpenNewsletter).toHaveBeenCalledOnce();
});
