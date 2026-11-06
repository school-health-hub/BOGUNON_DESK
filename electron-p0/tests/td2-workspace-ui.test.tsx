// @vitest-environment jsdom
import {useState} from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {WorkspaceHeader,WorkspaceShell} from '../renderer/ui/WorkspaceShell';
import {SurfaceDialog} from '../renderer/SurfaceDialog';

afterEach(cleanup);
describe('TD2 workspace presentation boundaries',()=>{
 it('retains an expert editor instance and unsaved input when its shell rerenders',()=>{
  function Editor(){const [text,setText]=useState('합성 원고');return <textarea aria-label="검토 원고" value={text} onChange={e=>setText(e.target.value)}/>;}
  const view=render(<WorkspaceShell name="official"><Editor/></WorkspaceShell>);
  fireEvent.change(screen.getByLabelText('검토 원고'),{target:{value:'아직 저장하지 않은 수정'}});
  const input=screen.getByLabelText('검토 원고');
  view.rerender(<WorkspaceShell name="official"><Editor/></WorkspaceShell>);
  expect(screen.getByLabelText('검토 원고')).toBe(input);
  expect((input as HTMLTextAreaElement).value).toBe('아직 저장하지 않은 수정');
  // Shell is presentational, with no modal, role or additional focus owner.
  expect(screen.queryByRole('dialog')).toBeNull();
 });
 it('keeps back navigation disabled during the existing owner operation',()=>{
  const back=vi.fn();const view=render(<WorkspaceHeader title="학교 행정 업무 도우미" description="공식 로그인은 브라우저에서 진행" onBack={back} backDisabled/>);
  fireEvent.click(screen.getByRole('button',{name:'보건 업무로'}));expect(back).not.toHaveBeenCalled();
  view.rerender(<WorkspaceHeader title="학교 행정 업무 도우미" onBack={back}/>);
  fireEvent.click(screen.getByRole('button',{name:'보건 업무로'}));expect(back).toHaveBeenCalledOnce();
 });
 it.each(['quick-memo-surface','instructor-preview-overlay'])('does not retheme the protected %s surface',overlayClassName=>{
  render(<SurfaceDialog title="기존 화면" overlayClassName={overlayClassName} modal={false} onClose={()=>{}}><button>기존 행동</button></SurfaceDialog>);
  const dialog=screen.getByRole('dialog');expect(dialog.classList.contains('td2-dialog')).toBe(false);expect(dialog.hasAttribute('aria-modal')).toBe(false);
 });
 it('preserves modal focus isolation and restores the invoker with the common dialog style',()=>{
  function Host(){const [open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>설정 열기</button>{open&&<SurfaceDialog title="설정" onClose={()=>setOpen(false)}><button>확인</button></SurfaceDialog>}</>;}
  const view=render(<Host/>);const invoker=screen.getByText('설정 열기');invoker.focus();fireEvent.click(invoker);
  const first=screen.getByRole('button',{name:'설정 닫기'}),last=screen.getByText('확인');
  expect(screen.getByRole('dialog').classList.contains('td2-dialog')).toBe(true);expect(view.container.inert).toBe(true);
  fireEvent.keyDown(first,{key:'Tab',shiftKey:true});expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last,{key:'Tab'});expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first,{key:'Escape'});expect(document.activeElement).toBe(invoker);expect(view.container.inert).toBe(false);
 });
});
