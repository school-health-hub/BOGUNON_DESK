// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ChatGptSettings } from '../renderer/ai/ChatGptSettings';
import { SettingsContent } from '../renderer/settings/SettingsApp';
import { createDefaultDashboardLayout } from '../../src/dashboard/layouts';
import { createDefaultDockLayout } from '../../src/dock/storage';

afterEach(cleanup);
it('keeps configuration controls while excluding generation in configuration-only ChatGPT settings',()=>{
  Object.defineProperty(window,'electronWork',{configurable:true,value:{chatgpt:{status:async()=>({ok:true,data:{supported:false,phase:'disconnected',busy:false,accountId:null,identity:null,planUsageEnabled:false,models:[],model:null,textCallVerified:false,showPlanNotice:false,notice:''}})}}});
  render(<ChatGptSettings configurationOnly/>);
  expect(screen.getByRole('button',{name:/Continue with ChatGPT/})).toBeTruthy();
  expect(screen.getByRole('button',{name:'ChatGPT 모델 목록 새로고침'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:/합성 텍스트 요청/})).toBeNull();
});

it('renders one settings navigation directly and read-only product information',()=>{
  Object.defineProperty(window,'electronWork',{configurable:true,value:{}});
  Object.defineProperty(window,'electronSurfaceSettings',{configurable:true,value:{read:async()=>({revision:0,value:null}),subscribe:()=>()=>{},write:async()=>({revision:1,value:null})}});
  render(<SettingsContent initial={{revision:0,value:{version:1,dashboard:createDefaultDashboardLayout(),dock:createDefaultDockLayout()}}} info={{productName:'BOGUNON DESK',appId:'synthetic',sourceSha:'synthetic-sha',electron:'synthetic',userData:'synthetic-profile'}} section="about"/>);
  expect(screen.getAllByRole('navigation')).toHaveLength(1);
  expect(within(screen.getByRole('navigation')).getAllByRole('button')).toHaveLength(7);
  expect(screen.getByText('synthetic-sha')).toBeTruthy();
  expect(screen.queryByRole('button',{name:/보건소식지 제작소 열기/})).toBeNull();
});

it('returns to a requested section when the same destination is requested again',()=>{
  Object.defineProperty(window,'electronWork',{configurable:true,value:{}});
  Object.defineProperty(window,'electronSurfaceSettings',{configurable:true,value:{read:async()=>({revision:0,value:null}),subscribe:()=>()=>{},write:async()=>({revision:1,value:null})}});
  const props={initial:{revision:0,value:null},info:{productName:'BOGUNON DESK',appId:'synthetic',sourceSha:'synthetic',electron:'synthetic',userData:'synthetic'}};
  const view=render(<SettingsContent {...props} section="about" sectionRequest={0}/>);
  fireEvent.click(screen.getByRole('button',{name:'이 PC'}));
  expect(screen.getByRole('heading',{name:'이 PC'})).toBeTruthy();
  view.rerender(<SettingsContent {...props} section="about" sectionRequest={1}/>);
  expect(screen.getByRole('heading',{name:'앱 정보'})).toBeTruthy();
});
