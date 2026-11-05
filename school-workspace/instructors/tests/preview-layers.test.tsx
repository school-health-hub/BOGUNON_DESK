// @vitest-environment jsdom
import {useState} from 'react';import {it,expect,afterEach} from 'vitest';import {render,screen,fireEvent,cleanup} from '@testing-library/react';import {SurfaceDialog} from '../../../electron-p0/renderer/SurfaceDialog.js';
afterEach(cleanup);
function Harness(){const[open,setOpen]=useState(false);return <div data-testid="school" className="s05-overlay"><button onClick={()=>setOpen(true)}>출근관리부 미리보기</button>{open&&<SurfaceDialog title="출력 미리보기" overlayClassName="instructor-preview-overlay" restoreScroll onClose={()=>setOpen(false)}><input aria-label="확인자"/><button>인쇄 확인</button><button onClick={()=>setOpen(false)}>취소</button></SurfaceDialog>}</div>;}
it('uses a dedicated body-portal layer, contains focus, makes background inert and restores opener/scroll',()=>{
 render(<Harness/>);const background=screen.getByTestId('school'),opener=screen.getByRole('button',{name:'출근관리부 미리보기'});background.scrollTop=180;opener.focus();fireEvent.click(opener);
 const dialog=screen.getByRole('dialog',{name:'출력 미리보기'}),overlay=dialog.parentElement!;expect(overlay.parentElement).toBe(document.body);expect(overlay.classList.contains('instructor-preview-overlay')).toBe(true);expect(background.parentElement!.inert).toBe(true);expect(dialog.getAttribute('aria-modal')).toBe('true');
 const close=screen.getByRole('button',{name:'출력 미리보기 닫기'}),last=screen.getByRole('button',{name:'취소'});expect(document.activeElement).toBe(close);fireEvent.keyDown(close,{key:'Tab',shiftKey:true});expect(document.activeElement).toBe(last);fireEvent.keyDown(last,{key:'Tab'});expect(document.activeElement).toBe(close);opener.focus();expect(dialog.contains(document.activeElement)).toBe(true);
 background.scrollTop=450;fireEvent.keyDown(close,{key:'Escape'});expect(screen.queryByRole('dialog')).toBeNull();expect(background.parentElement!.inert).toBe(false);expect(document.activeElement).toBe(opener);expect(background.scrollTop).toBe(180);
});
it('common SurfaceDialog callers retain their original layer and close handling',()=>{
 const v=render(<SurfaceDialog title="기존 설정" onClose={()=>{}}><button>원래 설정</button></SurfaceDialog>);expect(screen.getByRole('dialog').parentElement!.className).toBe('rose-overlay');v.unmount();
 render(<Harness/>);const opener=screen.getByRole('button',{name:'출근관리부 미리보기'});opener.focus();fireEvent.click(opener);fireEvent.click(screen.getByRole('button',{name:'출력 미리보기 닫기'}));expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(opener);
});
