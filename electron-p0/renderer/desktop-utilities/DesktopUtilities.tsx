import {useEffect} from 'react';
import {CalculatorPanel} from '../../../src/components/desktop/CalculatorPanel';
import {CommandPaletteView} from '../../../src/components/desktop/CommandPaletteView';
import type {CommandId} from '../../../src/commands/types';import type {WorkFolderFavorite} from '../../../src/work-folders/types';
import type {BogunonSearchState} from '../../../src/workspace-search/types';
import {isCommandPaletteShortcut} from '../../../src/commands/commandKeyboard';
import {useWidgetSession} from '../../../src/dashboard/WidgetSessionContext';
import {formatWorkspaceDate} from '../../../src/workspace-data/workspaceDataAdapter';
import {SurfaceDialog} from '../SurfaceDialog';import {LocalQuickAdd} from './LocalQuickAdd';import {electronCommands} from './commands';
import './utilities.css';
export type UtilityRequest={kind:'calculator'|'palette';key:string}|{kind:'quick-add';key:string;date?:string;title?:string};
const useLocalOnlySearch=():BogunonSearchState=>({status:'idle'});
export function DesktopUtilities({request,onOpen,onClose,onNotice,onCommand,favorites,onFolder,blocked}:{request:UtilityRequest|null;onOpen:(kind:UtilityRequest['kind'])=>void;onClose:()=>void;onNotice:(message:string)=>void;onCommand:(id:CommandId)=>Promise<void>;favorites:readonly WorkFolderFavorite[];onFolder:(folder:WorkFolderFavorite)=>Promise<void>;blocked:()=>boolean}){
 const {now}=useWidgetSession(),date=formatWorkspaceDate(now);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{
   if(event.defaultPrevented||event.isComposing||event.repeat||event.shiftKey||!isCommandPaletteShortcut(event))return;
   const input=document.querySelector<HTMLInputElement>('.p0-command-palette input'),dialogs=[...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')],top=dialogs[dialogs.length-1];
   if(request?.kind==='palette'&&input&&(!top||top.contains(input))){event.preventDefault();input.focus();return;}
   if(top||blocked())return;event.preventDefault();onOpen('palette');
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[request,blocked,onOpen]);
 if(!request)return null;
 if(request.kind==='quick-add')return <LocalQuickAdd key={request.key} date={request.date??date} title={request.title} onClose={onClose} onNotice={onNotice}/>;
 if(request.kind==='calculator')return <SurfaceDialog title="업무 계산기" onClose={onClose}><CalculatorPanel embedded initialDate={date} onClose={onClose} onNotice={onNotice}/></SurfaceDialog>;
 return <SurfaceDialog title="명령 팔레트" onClose={onClose}><CommandPaletteView embedded isOpen shortcutsEnabled={false} showServerSearch={false} useSearchState={useLocalOnlySearch} commands={electronCommands} onError={onNotice} favorites={favorites.filter(f=>f.available)} onClose={onClose} onRequestOpen={()=>onOpen('palette')} onCommand={onCommand} onFolder={onFolder} onSearchResult={async()=>{throw Error('서버 검색은 지원하지 않습니다.');}}/></SurfaceDialog>;
}
