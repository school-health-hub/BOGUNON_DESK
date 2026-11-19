import type {P0Settings,IpcResult,MemoDocument} from './protocol.js';
import type {EventLoad} from './local-events.js';
import type {LocalTaskLoad} from './local-tasks.js';
export type PaletteRect=Readonly<{x:number;y:number;width:number;height:number}>;
export type PaletteProfileSummary=Readonly<{profileKey:string;label:string;connected:boolean;ownedWidgetIds:readonly string[]}>;
export type PaletteSurface=Readonly<{profileKey:string;layout:unknown|null;ownedWidgetIds:readonly string[];dockVisible:boolean;profiles:readonly PaletteProfileSummary[]}>;
export type PaletteWidgetAction=Readonly<{action:'claim'|'move'|'hide'|'show';widgetId:string;targetProfileKey?:string}>;
export interface PaletteBridge{
  readSurface():Promise<PaletteSurface>;
  writeLayout(layout:unknown):Promise<PaletteSurface>;
  updateWidget(action:PaletteWidgetAction):Promise<PaletteSurface>;
  setDockMonitor():Promise<PaletteSurface>;
  beginEdit():Promise<void>;
  finishEdit(commit:boolean):Promise<PaletteSurface>;
  onSurfaceChanged(listener:()=>void):()=>void;
  readSettings():Promise<P0Settings|null>;
  ready():Promise<void>;
  setHitRegions(regions:readonly PaletteRect[]):Promise<void>;
  setInteractive(interactive:boolean):Promise<void>;
  openWorkspace():Promise<void>;
  openSettings():Promise<void>;
  readMemo():Promise<IpcResult<MemoDocument>>;
  writeMemo(document:MemoDocument):Promise<IpcResult<MemoDocument>>;
  readEvents():Promise<IpcResult<EventLoad>>;
  readTasks():Promise<IpcResult<LocalTaskLoad>>;
}
