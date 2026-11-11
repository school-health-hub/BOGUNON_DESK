// @vitest-environment jsdom
import {useState,useRef} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {SurfaceDialog} from '../renderer/SurfaceDialog';
import {SurfaceSettings} from '../renderer/SurfaceSettings';
afterEach(cleanup);
it('keeps programmatic focus inside Settings while it is modal',()=>{
 render(<><button>배경</button><SurfaceDialog title="설정" onClose={()=>{}}><input aria-label="설정 입력"/></SurfaceDialog></>);
 screen.getByText('배경').focus();
 expect(document.activeElement).toBe(screen.getByRole('button',{name:'설정 닫기'}));
});
it('closes only the active modal on Escape above an ordinary work panel',()=>{
 const panelClose=vi.fn(),modalClose=vi.fn();
 render(<><SurfaceDialog title="업무 도구" modal={false} onClose={panelClose}><button>업무 항목</button></SurfaceDialog><SurfaceDialog title="설정" onClose={modalClose}><button>설정 항목</button></SurfaceDialog></>);
 fireEvent.keyDown(screen.getByRole('button',{name:'설정 닫기'}),{key:'Escape'});
 expect(modalClose).toHaveBeenCalledTimes(1);expect(panelClose).not.toHaveBeenCalled();
});
it('contains keyboard focus, closes on Escape and restores the invoker without leaving background inert',()=>{
 function Host(){const [open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>설정 열기</button>{open&&<SurfaceDialog title="설정" onClose={()=>setOpen(false)}><button>마지막 항목</button></SurfaceDialog>}</>}
 const view=render(<Host/>),trigger=screen.getByText('설정 열기');trigger.focus();fireEvent.click(trigger);
 const close=screen.getByRole('button',{name:'설정 닫기'}),last=screen.getByText('마지막 항목');expect(document.activeElement).toBe(close);expect(view.container.inert).toBe(true);
 fireEvent.keyDown(close,{key:'Tab',shiftKey:true});expect(document.activeElement).toBe(last);
 fireEvent.keyDown(last,{key:'Tab'});expect(document.activeElement).toBe(close);
 fireEvent.keyDown(close,{key:'Escape'});expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(trigger);expect(view.container.inert).toBe(false);
});
it('presents the unified settings groups and switches the visible editor',()=>{
 render(<SurfaceSettings initialCategory="appearance" saveStatus="설정 저장됨" account={<p>계정 상태</p>} school={<p>학교 연결</p>} ai={<p>AI 연결 상태</p>} appearance={<button>기존 배경 옵션</button>} widgets={<p>기존 위젯 목록</p>} dock={<p>기존 Dock 순서</p>} about={<p>소스 정보</p>}/>);
 expect(screen.getByText('기존 배경 옵션')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Dock'}));expect(screen.getByText('기존 Dock 순서')).toBeTruthy();expect(screen.queryByText('기존 배경 옵션')).toBeNull();
 expect(screen.getByRole('button',{name:'Dock'}).getAttribute('aria-current')).toBe('page');
 fireEvent.click(screen.getByRole('button',{name:'앱 정보'}));expect(screen.getByText('소스 정보')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'자동 로그인'})).toBeNull();
});
it('does not invoke a close callback on unrelated typing',()=>{const close=vi.fn();render(<SurfaceDialog title="메모" onClose={close}><textarea aria-label="메모 입력"/></SurfaceDialog>);fireEvent.keyDown(screen.getByLabelText('메모 입력'),{key:'a'});expect(close).not.toHaveBeenCalled()});

it.each(['빠른 메모','업무 도구'])('%s is nonmodal: no inert background, trap or modal claim',title=>{
 const close=vi.fn();const view=render(<><button>배경 Dock</button><SurfaceDialog title={title} modal={false} onClose={close}><button>패널 마지막</button></SurfaceDialog></>);
 const dialog=screen.getByRole('dialog',{name:title});expect(dialog.hasAttribute('aria-modal')).toBe(false);expect(view.container.inert??false).toBe(false);
 const last=screen.getByText('패널 마지막');last.focus();const tab=new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});last.dispatchEvent(tab);expect(tab.defaultPrevented).toBe(false);
 const background=screen.getByText('배경 Dock');background.focus();fireEvent.keyDown(background,{key:'Escape'});expect(close).not.toHaveBeenCalled();
 last.focus();fireEvent.keyDown(last,{key:'Escape'});expect(close).toHaveBeenCalledTimes(1);
});
it('does not restore a hidden Settings invoker during Newsletter handoff',()=>{
 function Host(){const [open,setOpen]=useState(false),[newsletter,setNewsletter]=useState(false);const allow=useRef(true);return <><div hidden={newsletter}><button onClick={()=>{allow.current=true;setOpen(true)}}>설정 호출자</button></div>{open&&<SurfaceDialog title="설정" shouldRestoreFocus={()=>allow.current} onClose={()=>setOpen(false)}><button onClick={()=>{allow.current=false;setOpen(false);setNewsletter(true)}}>보건소식지 제작소</button></SurfaceDialog>}{newsletter&&<button>소식지 작업실</button>}</>}
 render(<Host/>);const invoker=screen.getByText('설정 호출자');invoker.focus();fireEvent.click(invoker);const restore=vi.spyOn(invoker,'focus');fireEvent.click(screen.getByText('보건소식지 제작소'));expect(restore).not.toHaveBeenCalled();expect(document.activeElement).not.toBe(invoker);
});
it('excludes hidden editor controls from modal tab endpoints',()=>{
 render(<SurfaceDialog title="설정" onClose={()=>{}}><div style={{display:'none'}}><button>숨긴 닫기</button></div><button>보이는 마지막</button></SurfaceDialog>);
 const first=screen.getByRole('button',{name:'설정 닫기'});first.focus();fireEvent.keyDown(first,{key:'Tab',shiftKey:true});expect(document.activeElement).toBe(screen.getByText('보이는 마지막'));
});
