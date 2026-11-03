import {z} from 'zod';
import type {Binding} from '../identity.js';
import type {TrustedHostExtension} from '../native02/launcher.js';
import {HostError} from '../native02/errors.js';
export const cases=['normal','cancel','host-lost','foreign-window'] as const;
export type CaseId=typeof cases[number];
const report=z.strictObject({scope:z.literal('DryRun'),sequence:z.number().int().positive(),accepted:z.boolean(),
  state:z.enum(['Detached','Preparing','ModelAttached','Recovering','CleanupUnknown']),
  cleanup:z.enum(['NotVerified','CleanupUnknown']),error:z.string().nullable(),actualAttachmentVerified:z.literal(false)});
export type DryRunReport=z.infer<typeof report>;
/** Closed application DTO over S-3 framing/capability. No arbitrary caller-supplied operations. */
export class DryRunExtension implements TrustedHostExtension {
  #used=false;#binding:Binding|null=null;#reports:DryRunReport[]=[];
  constructor(readonly sourceSha:string,readonly caseId:CaseId){
    if(!/^[a-f0-9]{40}$/.test(sourceSha)||!cases.includes(caseId))throw new HostError('ProtocolRejected');
  }
  get reports():readonly DryRunReport[]{return this.#reports.slice();}
  prepare(binding:Binding):Readonly<Record<string,unknown>>{
    if(this.#binding)throw new HostError('AlreadyStarted');this.#binding=binding;
    return {sourceSha:this.sourceSha,mode:'DryRun',modelWindow:901,hostCreated:binding.owner.creationTime.toString(),
      explorerPid:binding.explorer.process.pid,explorerCreated:binding.explorer.process.creationTime.toString()};
  }
  async run(exchange:(body:Readonly<Record<string,unknown>>)=>Promise<Buffer>):Promise<void>{
    const b=this.#binding;if(!b||this.#used)throw new HostError('AuthenticationFailed');this.#used=true;
    const plan=this.caseId==='normal'?['attach','attach','detach','attach']:
      this.caseId==='cancel'?['prepare','cancel','attach']:
      this.caseId==='host-lost'?['attach','host_lost_fixture','attach']:['attach'];
    let sequence=0;
    for(const operation of plan){
      const bytes=await exchange({sourceSha:this.sourceSha,mode:'DryRun',sequence:++sequence,hostPid:b.owner.pid,
        modelWindow:this.caseId==='foreign-window'?902:901,explorerCreated:b.explorer.process.creationTime.toString(),operation});
      try{
        const r=report.parse(JSON.parse(bytes.toString('utf8')));
        if(r.sequence!==sequence)throw new HostError('ProtocolRejected');this.#reports.push(r);
      }finally{bytes.fill(0);}
    }
    const r=this.#reports;
    const expected=this.caseId==='normal'?r[0]?.state==='ModelAttached'&&r[1]?.error==='Busy'&&r[2]?.accepted&&r[3]?.error==='Retired':
      this.caseId==='cancel'?r[0]?.state==='Preparing'&&r[1]?.accepted&&r[2]?.error==='Retired':
      this.caseId==='host-lost'?r[1]?.state==='CleanupUnknown'&&r[2]?.error==='CleanupUnknown':r[0]?.error==='Owner';
    if(!expected)throw new HostError('ProtocolRejected');
  }
}
