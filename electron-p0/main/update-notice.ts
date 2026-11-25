import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import type {UpdateState} from '../update-protocol.js';

export const UPDATE_CHECK_INTERVAL_MS=6*60*60*1000;

export class UpdateNotice {
  private lastVersion:string|null=null;
  private active=false;
  constructor(private readonly file:string,private readonly show:(version:string)=>boolean|Promise<boolean>){}
  async load():Promise<void>{
    try{const value=JSON.parse(await readFile(this.file,'utf8')) as unknown;
      if(value&&typeof value==='object'&&'version' in value&&typeof value.version==='string')this.lastVersion=value.version;
    }catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='ENOENT'))this.active=false;}
  }
  async observe(state:UpdateState):Promise<void>{
    if(state.phase!=='available'||!state.nextVersion||this.active||this.lastVersion===state.nextVersion)return;
    this.active=true;
    try{
      if(!await this.show(state.nextVersion))return;
      await mkdir(dirname(this.file),{recursive:true});
      const temporary=`${this.file}.${process.pid}.partial`;
      try{await writeFile(temporary,JSON.stringify({version:state.nextVersion}),{flag:'wx'});await rename(temporary,this.file);}
      finally{await rm(temporary,{force:true}).catch(()=>{});}
      this.lastVersion=state.nextVersion;
    }finally{this.active=false;}
  }
}
