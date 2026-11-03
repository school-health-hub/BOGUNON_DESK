// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {ToolCard} from '../renderer/ToolCard';
import {InventoryEntryButtons} from '../renderer/inventory-preview/InventoryEntryButtons';
import {NewsletterOutputControls} from '../renderer/adapters/NewsletterOutputControls';
import {bFixture} from './newsletter-b-fixture';
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('preserves native focus and an accessible tool description',()=>{
 const open=vi.fn();render(<ToolCard label="공문작업실 · 로컬 초안" description="공문 편집" onClick={open}/>);
 const button=screen.getByRole('button',{name:'공문작업실 · 로컬 초안'});
 button.focus();expect(document.activeElement).toBe(button);expect(button.tabIndex).toBe(0);
 expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe('공문 편집');
 fireEvent.click(button);expect(open).toHaveBeenCalledTimes(1);
});
it('keeps local and preview route values distinct',()=>{
 const select=vi.fn();render(<InventoryEntryButtons onSelect={select}/>);
 fireEvent.click(screen.getByRole('button',{name:'물품관리 — 로컬 저장'}));
 fireEvent.click(screen.getByRole('button',{name:'물품관리 — 미리보기'}));
 expect(select.mock.calls).toEqual([['local'],['preview']]);
});
it('keeps blocked output natively disabled and explains why without exporting',()=>{
 const fixture=bFixture(),exportOutput=vi.fn();Object.assign(window,{electronWork:{newsletter:{exportOutput}}});
 const props={project:fixture.project,design:fixture.design,ready:false,blockedReason:'텍스트가 영역을 벗어났습니다.'};
 const view=render(<NewsletterOutputControls {...props}/>);
 const button=screen.getByRole('button',{name:'출력 위치 선택·저장'}) as HTMLButtonElement;
 expect(button.disabled).toBe(true);expect(button.className).toBe('p0-newsletter-export');
 expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toContain(props.blockedReason);
 fireEvent.click(button);fireEvent.keyDown(button,{key:'Enter'});fireEvent.keyDown(button,{key:' '});expect(exportOutput).not.toHaveBeenCalled();
 view.rerender(<NewsletterOutputControls {...props} ready={true}/>);
 expect(button.disabled).toBe(false);expect(button.hasAttribute('aria-describedby')).toBe(false);
});
