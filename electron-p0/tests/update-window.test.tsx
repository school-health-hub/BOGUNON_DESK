// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { UpdateState } from '../update-protocol';

it('lets the user cancel while the download request is still pending', async () => {
  document.body.innerHTML = '<div id="root"></div>';
  const available: UpdateState = {phase:'available',currentVersion:'2.0.0-beta.14'};
  const downloading: UpdateState = {...available,phase:'downloading',progress:12};
  let notify: (state: UpdateState) => void = () => {};
  const download=vi.fn(()=>new Promise<UpdateState>(()=>{notify(downloading);}));
  const cancel=vi.fn(async()=>available);
  vi.stubGlobal('electronUpdate',{
    status:async()=>available,
    onState:(listener:typeof notify)=>{notify=listener;return ()=>{};},
    download,cancel
  });
  try{
    await act(async()=>{await import('../renderer/update/main');});
    fireEvent.click(await screen.findByRole('button',{name:'업데이트 받기'}));
    expect(download).toHaveBeenCalledOnce();
    await act(async()=>{fireEvent.click(await screen.findByRole('button',{name:'다운로드 취소'}));});
    expect(cancel).toHaveBeenCalledOnce();
  }finally{vi.unstubAllGlobals();}
});
