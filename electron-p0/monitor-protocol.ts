export interface MonitorRect { readonly x:number;readonly y:number;readonly width:number;readonly height:number; }
export interface MonitorObservation {
  readonly displayId:number;readonly label:string;readonly primary:boolean;
  readonly bounds:MonitorRect;readonly workArea:MonitorRect;readonly scaleFactor:number;
  readonly identityKey:string|null;readonly identityKind:'device-path'|'uncertain';
}
export interface MonitorProfile {
  readonly id:string;readonly identityKey:string|null;readonly identityKind:'device-path'|'uncertain';
  readonly label:string;readonly visible:boolean;readonly connected:boolean;readonly dormant:boolean;
  readonly lastDisplayId:number;readonly lastBounds:MonitorRect;readonly scaleFactor:number;
  readonly layoutRef:string;
}
export interface MonitorDocument {readonly version:1;readonly revision:number;readonly profiles:readonly MonitorProfile[];readonly layouts:Readonly<Record<string,unknown>>;}
export interface MonitorProfileView extends MonitorProfile {readonly display:MonitorObservation|null;readonly layout:unknown|null;}
export interface MonitorSnapshot {readonly revision:number;readonly profiles:readonly MonitorProfileView[];readonly writable:boolean;readonly error:string|null;}
export interface MonitorWrite {readonly revision:number;readonly profileId:string;readonly layout:unknown;readonly visible:boolean;}
export interface MonitorProfilesBridge {
 readonly read:()=>Promise<MonitorSnapshot>;
 readonly write:(request:MonitorWrite)=>Promise<MonitorSnapshot>;
 readonly subscribe:(listener:(snapshot:MonitorSnapshot)=>void)=>()=>void;
}
