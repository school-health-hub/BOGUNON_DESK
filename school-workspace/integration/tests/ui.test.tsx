// @vitest-environment jsdom
import {afterEach,describe,it,expect} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {WorkspacePanel} from '../dev-ui/WorkspacePanel.js';
import {createPreview} from '../dev-ui/preview.js';
afterEach(cleanup);
describe('MOCK browser UI only — no database or hosted authentication',()=>{
 for(const scenario of ['active','pending','session-expired','denied'])it(`safe mobile state: ${scenario}`,async()=>{
  render(<WorkspacePanel controller={createPreview(scenario)}/>);
  expect(screen.getByText(/개인 업무와 로컬 자료/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'로그인'}));await screen.findByText('학교를 선택해 주세요',{selector:'p'});
  fireEvent.change(screen.getByRole('combobox'),{target:{value:'synthetic-a'}});
  const text=scenario==='active'?'공동 기능을 이용할 수 있습니다':scenario==='pending'?'학교 가입 승인을 기다리고 있습니다':scenario==='session-expired'?'로그인 시간이 만료되었습니다':'이 학교에 접근할 권한이 없습니다';
  await screen.findByText(text);expect(document.body.textContent).not.toMatch(/accessToken|refreshToken|SCHOOL01C_MOCK|ws_v1|stack|SELECT/);
  fireEvent.click(screen.getByRole('button',{name:'로그아웃'}));await waitFor(()=>expect(screen.queryByRole('combobox')).toBeNull());
 });
});
