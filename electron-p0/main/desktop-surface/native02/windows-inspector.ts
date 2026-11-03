import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {z} from 'zod';
import {HostError} from './errors.js';
import {explorerIdentity} from '../identity.js';
import type {ExplorerIdentity,ProcessIdentity} from '../identity.js';

export type ObservedProcess=Readonly<{identity:ProcessIdentity;parentPid:number;imagePath:string}>;
export interface Inspector {process(pid:number):Promise<ObservedProcess|null>;explorer():Promise<ExplorerIdentity>;}
const row=z.strictObject({pid:z.number().int().positive(),parentPid:z.number().int().nonnegative(),
  creationTime:z.string().regex(/^[0-9]+$/),sessionId:z.number().int().nonnegative(),imagePath:z.string().min(1)});
const run=promisify(execFile);
/** Narrow process metadata only; never command lines, registry, tokens, AppData or profiles. */
export class WindowsInspector implements Inspector {
  async #query(filter:string):Promise<z.infer<typeof row>[]> {
    if(process.platform!=='win32')throw new HostError('InspectionFailed');
    const root=process.env['SystemRoot']??'C:\\Windows';
    const command=`$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); @(Get-CimInstance Win32_Process -Filter '${filter}' | ForEach-Object { [pscustomobject]@{pid=[int]$_.ProcessId;parentPid=[int]$_.ParentProcessId;creationTime=$_.CreationDate.ToUniversalTime().Ticks.ToString();sessionId=[int]$_.SessionId;imagePath=$_.ExecutablePath} }) | ConvertTo-Json -Compress`;
    try{
      const {stdout}=await run(join(root,'System32','WindowsPowerShell','v1.0','powershell.exe'),
        ['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:5000,maxBuffer:16384});
      const raw:unknown=stdout.trim()?JSON.parse(stdout):[];
      return z.array(row).parse(Array.isArray(raw)?raw:[raw]);
    }catch{throw new HostError('InspectionFailed');}
  }
  async #observe(value:z.infer<typeof row>):Promise<ObservedProcess>{
    try{
      const imagePath=await realpath(value.imagePath);
      const imageSha256=createHash('sha256').update(await readFile(imagePath)).digest('hex');
      return {identity:{pid:value.pid,creationTime:BigInt(value.creationTime),sessionId:BigInt(value.sessionId),imageSha256},
        parentPid:value.parentPid,imagePath};
    }catch{throw new HostError('InspectionFailed');}
  }
  async process(pid:number):Promise<ObservedProcess|null>{
    if(!Number.isSafeInteger(pid)||pid<=0)throw new HostError('InspectionFailed');
    const values=await this.#query(`ProcessId = ${pid}`);
    if(values.length===0)return null;
    if(values.length!==1)throw new HostError('InspectionFailed');
    const value=values[0];if(!value)throw new HostError('InspectionFailed');
    return this.#observe(value);
  }
  async explorer():Promise<ExplorerIdentity>{
    const self=await this.process(process.pid);if(!self)throw new HostError('InspectionFailed');
    const values=(await this.#query('Name = "explorer.exe"')).filter(v=>BigInt(v.sessionId)===self.identity.sessionId);
    if(values.length!==1)throw new HostError('InspectionFailed');
    const value=values[0];if(!value)throw new HostError('InspectionFailed');
    const observed=await this.#observe(value);
    const expected=await realpath(join(process.env['SystemRoot']??'C:\\Windows','explorer.exe'));
    if(observed.imagePath.toLowerCase()!==expected.toLowerCase())throw new HostError('InspectionFailed');
    return explorerIdentity.parse({generation:observed.identity.creationTime,process:observed.identity});
  }
}
