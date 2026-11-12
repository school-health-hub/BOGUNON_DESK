import {useEffect, useRef, useState} from 'react';
import {AppDock} from '../../../src/dock/AppDock';
import type {DockLayout} from '../../../src/dock/types';
import type {DesktopActionId} from '../../../src/desktop/types';
import {workspaceRegistry} from '../../../src/navigation/workspaceRegistry';
import {desktopModuleIds, type DesktopEntry} from '../../desktop-surface-protocol';

interface PaletteDockProps {
  readonly layout:DockLayout;
  readonly openWorkspace:(entry:DesktopEntry)=>void;
  readonly openSettings:()=>void;
}

export function PaletteDock({layout,openWorkspace,openSettings}:PaletteDockProps){
  const [expanded,setExpanded]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!expanded)return;
    const escape=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return;
      event.preventDefault();setExpanded(false);
      root.current?.querySelector<HTMLButtonElement>('[data-dock-item="toolbox"]')?.focus();
    };
    document.addEventListener('keydown',escape);
    return()=>document.removeEventListener('keydown',escape);
  },[expanded]);
  const action=(actionId:DesktopActionId)=>{
    switch(actionId){
      case 'toolbox':setExpanded(value=>!value);break;
      case 'settings':setExpanded(false);openSettings();break;
      default:setExpanded(false);openWorkspace({kind:'action',actionId});
    }
  };
  return <div className="palette-launcher" ref={root}>
    {expanded&&<nav className="palette-module-menu" aria-label="업무 도구 모듈" data-palette-interactive>
      {desktopModuleIds.map(moduleId=>{
        const definition=workspaceRegistry[moduleId],Icon=definition.icon;
        return <button type="button" key={moduleId} onClick={()=>{setExpanded(false);openWorkspace({kind:'module',moduleId});}}><Icon size={20} aria-hidden="true"/><span>{definition.label}</span></button>;
      })}
    </nav>}
    <div className="palette-dock-region" data-palette-interactive><AppDock dockLayout={layout} activeActionId={expanded?'toolbox':'home'} onAction={action}/></div>
  </div>;
}
