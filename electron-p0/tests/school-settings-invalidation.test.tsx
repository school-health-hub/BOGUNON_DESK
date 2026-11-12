// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SchoolProfileProvider, SchoolProfileSettings } from '../renderer/school-profile/SchoolProfile';
import type { SchoolLoad } from '../school-protocol';

vi.mock('../renderer/school-profile/SchoolSystemAddresses',()=>({SchoolSystemAddresses:({revision}:{revision?:number})=><output aria-label="주소 새로고침">{revision}</output>}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

it('reloads both cached school providers and invalidates address previews without saving on notification',async()=>{
  let current:SchoolLoad={document:{version:1,revision:0,school:{officeCode:'B10',officeName:'합성교육청',schoolCode:'synthetic',schoolName:'첫 합성학교'}},recovered:false,bogunon:'unavailable'};
  const load=vi.fn(async()=>({ok:true as const,data:current})),select=vi.fn();
  const listeners=new Set<()=>void>();
  vi.stubGlobal('electronWork',{school:{load,select,cancel:vi.fn(async()=>({ok:true,data:null}))}});
  vi.stubGlobal('electronSchoolSettings',{subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>listeners.delete(listener);}});
  const view=render(<><SchoolProfileProvider><SchoolProfileSettings/></SchoolProfileProvider><SchoolProfileProvider><SchoolProfileSettings/></SchoolProfileProvider></>);
  await waitFor(()=>expect(screen.getAllByText('현재 학교: 첫 합성학교')).toHaveLength(2));
  current={...current,document:{...current.document,revision:1,school:{officeCode:'B10',officeName:'합성교육청',schoolCode:'synthetic2',schoolName:'다음 합성학교'}}};
  act(()=>listeners.forEach(listener=>listener()));
  await waitFor(()=>expect(screen.getAllByText('현재 학교: 다음 합성학교')).toHaveLength(2));
  expect(screen.getAllByLabelText('주소 새로고침').map(output=>output.textContent)).toEqual(['1','1']);
  expect(load).toHaveBeenCalledTimes(4);
  expect(select).not.toHaveBeenCalled();
  view.unmount();
  expect(listeners.size).toBe(0);
});
