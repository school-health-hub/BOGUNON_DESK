// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {PaletteDock} from '../renderer/palette/PaletteDock';
import {createDefaultDockLayout} from '../../src/dock/storage';
import {desktopModuleIds} from '../desktop-surface-protocol';
import {workspaceRegistry} from '../../src/navigation/workspaceRegistry';

afterEach(cleanup);

it('routes the existing Dock to Settings and typed Workspace actions without changing persisted items',()=>{
  const openWorkspace=vi.fn(),openSettings=vi.fn();
  const layout=createDefaultDockLayout();
  render(<PaletteDock layout={layout} openWorkspace={openWorkspace} openSettings={openSettings}/>);
  fireEvent.click(screen.getByRole('button',{name:'설정'}));
  expect(openSettings).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button',{name:'빠른 메모'}));
  expect(openWorkspace).toHaveBeenCalledWith({kind:'action',actionId:'quick-memo'});
  expect(layout).toEqual(createDefaultDockLayout());
});

it('opens seven ephemeral module destinations and returns focus on Escape',()=>{
  const openWorkspace=vi.fn();
  render(<PaletteDock layout={createDefaultDockLayout()} openWorkspace={openWorkspace} openSettings={vi.fn()}/>);
  const toolbox=screen.getByRole('button',{name:'업무 도구'});
  fireEvent.click(toolbox);
  const menu=screen.getByRole('navigation',{name:'업무 도구 모듈'});
  expect(within(menu).getAllByRole('button')).toHaveLength(7);
  for(const moduleId of desktopModuleIds){
    fireEvent.click(within(screen.getByRole('navigation',{name:'업무 도구 모듈'})).getByRole('button',{name:workspaceRegistry[moduleId].label}));
    expect(openWorkspace).toHaveBeenLastCalledWith({kind:'module',moduleId});
    fireEvent.click(toolbox);
  }
  fireEvent.keyDown(document,{key:'Escape'});
  expect(screen.queryByRole('navigation',{name:'업무 도구 모듈'})).toBeNull();
  expect(document.activeElement).toBe(toolbox);
});
