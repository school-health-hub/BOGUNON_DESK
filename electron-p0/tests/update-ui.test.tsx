// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {ProductAbout} from '../renderer/ProductAbout';
import type {P0Info,P0UpdateState} from '../protocol';

const info:P0Info={appId:'kr.sungandi.schoolhealthdesk.electronp0',productName:'BOGUNON DESK',version:'2.0.0-beta.5',userData:'synthetic',sourceSha:'synthetic',electron:'45'};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

it('shows a clear offline fallback without attempting a network call',async()=>{
  const check=vi.fn();
  vi.stubGlobal('electronP0',{updates:{status:async()=>({phase:'unavailable',currentVersion:info.version,message:'수동 업데이트를 이용해 주세요.'}),onState:()=>()=>{},check}});
  render(<ProductAbout info={info} onOpenNewsletter={()=>{}}/>);
  expect(await screen.findByText('수동 업데이트를 이용해 주세요.')).toBeTruthy();
  expect(check).not.toHaveBeenCalled();
  expect(screen.queryByRole('button',{name:'업데이트 받기'})).toBeNull();
});

it('keeps download consent separate and explains unsigned-install restriction',async()=>{
  const available:P0UpdateState={phase:'available',currentVersion:info.version,nextVersion:'2.0.0-beta.6',notes:'합성 변경 사항'};
  const download=vi.fn(async():Promise<P0UpdateState>=>({...available,phase:'ready',progress:100,message:'파일을 검증했습니다.'}));
  vi.stubGlobal('electronP0',{updates:{status:async()=>available,onState:()=>()=>{},download,check:vi.fn(),cancel:vi.fn()}});
  render(<ProductAbout info={info} onOpenNewsletter={()=>{}}/>);
  expect(await screen.findByText('새 업데이트가 있어요!')).toBeTruthy();
  expect(download).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'업데이트 받기'}));
  await waitFor(()=>expect(download).toHaveBeenCalledTimes(1));
  expect(await screen.findByText(/현재 미서명 QA 후보는 앱에서 자동 설치하지 않습니다/)).toBeTruthy();
  expect(screen.queryByRole('button',{name:'업데이트 설치하고 다시 시작'})).toBeNull();
});
it('offers a separate install action only for a trusted ready installer',async()=>{
  const ready:P0UpdateState={phase:'ready',currentVersion:info.version,nextVersion:'2.0.0-beta.6',progress:100,installSupported:true,message:'서명 확인 대기'};
  const install=vi.fn(async():Promise<P0UpdateState>=>({...ready,phase:'installing'}));
  vi.stubGlobal('electronP0',{updates:{status:async()=>ready,onState:()=>()=>{},install,check:vi.fn(),download:vi.fn(),cancel:vi.fn()}});
  render(<ProductAbout info={info} onOpenNewsletter={()=>{}}/>);
  const button=await screen.findByRole('button',{name:'업데이트 설치하기'});
  expect(install).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(()=>expect(install).toHaveBeenCalledTimes(1));
});
