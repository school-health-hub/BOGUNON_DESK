// Debounce bursts, serialize native probes, and discard superseded observations.
export class TopologyReconciler<T> {
 private generation=0;private settled=0;private stopped=false;private running=false;
 private timer:ReturnType<typeof setTimeout>|undefined;
 constructor(private readonly read:()=>Promise<T>,private readonly apply:(value:T,current:()=>boolean)=>Promise<void>,private readonly failed:()=>void,private readonly delay=350){}
 schedule():void {if(this.stopped)return;this.generation++;clearTimeout(this.timer);this.timer=setTimeout(()=>{void this.drain();},this.delay);}
 async start():Promise<void>{this.generation++;await this.drain();}
 isSettling():boolean{return !this.stopped&&(this.running||this.generation!==this.settled);}
 private async drain():Promise<void>{
  if(this.running||this.stopped)return;this.running=true;
  try{while(!this.stopped){const version=this.generation;const value=await this.read();if(this.stopped)return;if(version!==this.generation)continue;await this.apply(value,()=>!this.stopped&&version===this.generation);if(version===this.generation){this.settled=version;return;}}}
  catch(error){if(!(error instanceof Error))throw error;if(!this.stopped)this.failed();}
  finally{this.running=false;}
 }
 stop():void{this.stopped=true;this.generation++;clearTimeout(this.timer);}
}
