import {describe,expect,it,vi} from 'vitest';
import {WorkspaceWindowLifecycle} from '../main/workspace-window-lifecycle';

class WindowFixture {
  visible=true;
  minimized=false;
  readonly hide=vi.fn(()=>{this.visible=false;});
  readonly show=vi.fn(()=>{this.visible=true;});
  readonly focus=vi.fn();
  readonly restore=vi.fn(()=>{this.minimized=false;});
  isMinimized(){return this.minimized;}
}

describe('WorkspaceWindowLifecycle',()=>{
  it('reuses the existing hidden window for repeated open requests',()=>{
    const window=new WindowFixture(),lifecycle=new WorkspaceWindowLifecycle(window);
    window.visible=false;
    lifecycle.open();lifecycle.open();
    expect(window.show).toHaveBeenCalledTimes(2);
    expect(window.focus).toHaveBeenCalledTimes(2);
  });

  it('restores a minimized window before showing and focusing it',()=>{
    const window=new WindowFixture(),lifecycle=new WorkspaceWindowLifecycle(window);
    window.minimized=true;
    lifecycle.open();
    expect(window.restore).toHaveBeenCalledOnce();
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.focus).toHaveBeenCalledOnce();
  });

  it('hides on close only while a tray recovery route exists',()=>{
    const window=new WindowFixture(),lifecycle=new WorkspaceWindowLifecycle(window);
    expect(lifecycle.requestClose(true)).toBe('hidden');
    expect(window.hide).toHaveBeenCalledOnce();
    expect(lifecycle.requestClose(false)).toBe('quit-required');
    expect(window.hide).toHaveBeenCalledOnce();
  });

  it('blocks open and duplicate quit after explicit quit begins',()=>{
    const window=new WindowFixture(),lifecycle=new WorkspaceWindowLifecycle(window);
    expect(lifecycle.beginQuit()).toBe(true);
    expect(lifecycle.beginQuit()).toBe(false);
    lifecycle.open();
    expect(window.show).not.toHaveBeenCalled();
    expect(window.focus).not.toHaveBeenCalled();
    expect(lifecycle.requestClose(true)).toBe('quitting');
    expect(window.hide).not.toHaveBeenCalled();
  });
});
