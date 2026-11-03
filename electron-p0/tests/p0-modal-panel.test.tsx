// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { P0LegacyPanel, P0ModalPanel } from '../renderer/P0ModalPanel';

afterEach(() => cleanup());

function Harness() {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)}>설정</button>{open && <P0ModalPanel label="PoC 설정" onClose={() => setOpen(false)}><button type="button" onClick={() => setOpen(false)}>홈으로</button><button type="button">마지막 작업</button></P0ModalPanel>}</>;
}

it('contains focus in both directions and restores the settings launcher', () => {
  render(<Harness />);
  const launcher = screen.getByRole('button', { name: '설정' });
  launcher.focus();fireEvent.click(launcher);
  const dialog = screen.getByRole('dialog', { name: 'PoC 설정' });
  const first = screen.getByRole('button', { name: '홈으로' }),last = screen.getByRole('button', { name: '마지막 작업' });
  expect(dialog.getAttribute('aria-modal')).toBe('true');expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: 'Tab' });expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: 'Escape' });expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(launcher);
});

it('restores focus after the close button path and can reopen without stale focus', () => {
  render(<Harness />);
  const launcher = screen.getByRole('button', { name: '설정' });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    launcher.focus();fireEvent.click(launcher);
    const close = screen.getByRole('button', { name: '홈으로' });expect(document.activeElement).toBe(close);fireEvent.click(close);expect(document.activeElement).toBe(launcher);
  }
});

it('does not restore background focus while handing settings off to Newsletter Studio', () => {
  function NewsletterHandoffHarness() {
    const [surface, setSurface] = useState<'home' | 'settings' | 'newsletter'>('home');
    const handoff = useRef(false);
    return <><button type="button" onClick={() => { handoff.current = false;setSurface('settings'); }}>설정</button>{surface === 'settings' && <P0ModalPanel label="PoC 설정" onClose={() => setSurface('home')} shouldRestoreFocus={() => !handoff.current}><button type="button" onClick={() => setSurface('home')}>홈으로</button><button type="button" onClick={() => { handoff.current = true;setSurface('newsletter'); }}>보건소식지 제작소</button></P0ModalPanel>}{surface === 'newsletter' && <main><h1>보건소식지 제작소</h1></main>}</>;
  }
  render(<NewsletterHandoffHarness />);
  const launcher = screen.getByRole('button', { name: '설정' });launcher.focus();fireEvent.click(launcher);
  fireEvent.click(screen.getByRole('button', { name: '보건소식지 제작소' }));
  expect(screen.getByRole('heading', { name: '보건소식지 제작소' })).toBeTruthy();expect(document.activeElement).not.toBe(launcher);
});

it('keeps quick memo and toolbox on the legacy non-modal, non-trapping behavior', () => {
  render(<><button type="button">배경 작업</button><P0LegacyPanel label="빠른 메모"><button type="button">홈으로</button><button type="button">마지막 작업</button></P0LegacyPanel></>);
  const dialog=screen.getByRole('dialog',{name:'빠른 메모'}),background=screen.getByRole('button',{name:'배경 작업'}),last=screen.getByRole('button',{name:'마지막 작업'});
  expect(dialog.hasAttribute('aria-modal')).toBe(false);expect(document.activeElement).toBe(document.body);
  last.focus();fireEvent.keyDown(last,{key:'Tab'});background.focus();expect(document.activeElement).toBe(background);
});
