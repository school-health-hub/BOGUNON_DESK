import type {Rectangle} from 'electron';
type PaletteWindow={isDestroyed():boolean;isVisible():boolean;showInactive():void;hide():void;setIgnoreMouseEvents(ignore:boolean,options?:{readonly forward:boolean}):void;destroy():void};
export const desktopPaletteOptions=(workArea:Rectangle)=>({...workArea,transparent:true,frame:false,skipTaskbar:true,alwaysOnTop:false,show:false,backgroundColor:'#00000000',hasShadow:false,focusable:true,resizable:false,movable:false} as const);
export class DesktopPaletteLifecycle{
  private quitting=false;private interactive=false;
  constructor(private readonly window:PaletteWindow){}
  show():void{if(this.quitting||this.window.isDestroyed())return;this.interactive=false;this.window.setIgnoreMouseEvents(true,{forward:true});this.window.showInactive();}
  hide():void{if(this.quitting||this.window.isDestroyed())return;this.interactive=false;this.window.setIgnoreMouseEvents(true,{forward:true});this.window.hide();}
  setInteractive(interactive:boolean):void{if(this.quitting||this.window.isDestroyed()||this.interactive===interactive)return;this.interactive=interactive;if(interactive)this.window.setIgnoreMouseEvents(false);else this.window.setIgnoreMouseEvents(true,{forward:true});}
  beginQuit():void{if(this.quitting)return;this.quitting=true;if(!this.window.isDestroyed())this.window.destroy();}
}
