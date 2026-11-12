export type GuardedWorkspaceOwner='official'|'inventory'|'finance'|'newsletter';
export class WorkspaceEntryTransition<T> {
  private requestState:Readonly<{entry:T;owner:GuardedWorkspaceOwner;accepted:boolean}>|null=null;
  get pending():boolean{return this.requestState!==null;}
  request(entry:T,owner:GuardedWorkspaceOwner):boolean{
    if(this.requestState)return false;
    this.requestState={entry,owner,accepted:false};return true;
  }
  resolve(owner:GuardedWorkspaceOwner,accepted:boolean):void{
    if(this.requestState?.owner!==owner)return;
    this.requestState=accepted?{...this.requestState,accepted:true}:null;
  }
  takeWhenClosed(owner:GuardedWorkspaceOwner|null):T|null{
    if(!this.requestState?.accepted||owner!==null)return null;
    const entry=this.requestState.entry;this.requestState=null;return entry;
  }
}
