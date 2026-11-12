export interface WorkspaceWindowPort {
  isMinimized():boolean;
  restore():void;
  show():void;
  focus():void;
  hide():void;
}

export type WorkspaceCloseResult='hidden'|'quit-required'|'quitting';

export class WorkspaceWindowLifecycle {
  private quitting=false;

  constructor(private readonly window:WorkspaceWindowPort){}

  open():void{
    if(this.quitting)return;
    if(this.window.isMinimized())this.window.restore();
    this.window.show();
    this.window.focus();
  }

  requestClose(hasRecoveryRoute:boolean):WorkspaceCloseResult{
    if(this.quitting)return 'quitting';
    if(!hasRecoveryRoute)return 'quit-required';
    this.window.hide();
    return 'hidden';
  }

  beginQuit():boolean{
    if(this.quitting)return false;
    this.quitting=true;
    return true;
  }

  isQuitInProgress():boolean{return this.quitting;}
}
