// @vitest-environment jsdom
import {useState} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {SurfaceDialog} from '../renderer/SurfaceDialog';
import {SurfaceSettings} from '../renderer/SurfaceSettings';
afterEach(cleanup);
it('contains keyboard focus, closes on Escape and restores the invoker without leaving background inert',()=>{
 function Host(){const [open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>설정 열기</button>{open&&<SurfaceDialog title="설정" onClose={()=>setOpen(false)}><button>마지막 항목</button></SurfaceDialog>}</>}
 const view=render(<Host/>),trigger=screen.getByText('설정 열기');trigger.focus();fireEvent.click(trigger);
 const close=screen.getByRole('button',{name:'설정 닫기'}),last=screen.getByText('마지막 항목');expect(document.activeElement).toBe(close);expect(view.container.inert).toBe(true);
 fireEvent.keyDown(close,{key:'Tab',shiftKey:true});expect(document.activeElement).toBe(last);
 fireEvent.keyDown(last,{key:'Tab'});expect(document.activeElement).toBe(close);
 fireEvent.keyDown(close,{key:'Escape'});expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(trigger);expect(view.container.inert).toBe(false);
});
it('presents only existing settings groups and switches the visible editor',()=>{
 render(<SurfaceSettings saveStatus="설정 저장됨" appearance={<button>기존 배경 옵션</button>} widgets={<p>기존 위젯 목록</p>} dock={<p>기존 Dock 순서</p>} about={<p>소스 정보</p>}/>);
 expect(screen.getByText('기존 배경 옵션')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Dock'}));expect(screen.getByText('기존 Dock 순서')).toBeTruthy();expect(screen.queryByText('기존 배경 옵션')).toBeNull();
 expect(screen.getByRole('button',{name:'Dock'}).getAttribute('aria-pressed')).toBe('true');
 expect(screen.queryByRole('button',{name:'자동 로그인'})).toBeNull();
});
it('does not invoke a close callback on unrelated typing',()=>{const close=vi.fn();render(<SurfaceDialog title="메모" onClose={close}><textarea aria-label="메모 입력"/></SurfaceDialog>);fireEvent.keyDown(screen.getByLabelText('메모 입력'),{key:'a'});expect(close).not.toHaveBeenCalled()});
