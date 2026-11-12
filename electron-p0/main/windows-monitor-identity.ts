import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {hostname} from 'node:os';
import {join} from 'node:path';
import type {Display,Point} from 'electron';
import type {MonitorObservation} from '../monitor-protocol.js';

// Read-only USER32 enumeration. No display-setting, registry-write or elevation API.
export const monitorProbeScript=String.raw`
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;
public static class BogunMonitorProbe {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct DD {
  public int cb;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=32)]public string name;
  [MarshalAs(UnmanagedType.ByValTStr,SizeConst=128)]public string label;public uint flags;
  [MarshalAs(UnmanagedType.ByValTStr,SizeConst=128)]public string id;
  [MarshalAs(UnmanagedType.ByValTStr,SizeConst=128)]public string key;
 }
 [StructLayout(LayoutKind.Explicit,Size=220)] public struct DM {
  [FieldOffset(68)]public ushort size;[FieldOffset(76)]public int x;[FieldOffset(80)]public int y;
  [FieldOffset(172)]public uint width;[FieldOffset(176)]public uint height;
 }
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern bool EnumDisplayDevices(string name,uint index,ref DD device,uint flags);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern bool EnumDisplaySettings(string name,int mode,ref DM settings);
 public static DD Device(){var d=new DD();d.cb=Marshal.SizeOf(typeof(DD));return d;}
 public static bool Adapter(uint index,ref DD device){return EnumDisplayDevices(null,index,ref device,0);}
}
'@
$rows=@();for($i=0;;$i++){
 $adapter=[BogunMonitorProbe]::Device();if(-not [BogunMonitorProbe]::Adapter($i,[ref]$adapter)){break}
 if(($adapter.flags-band 1)-eq 0){continue}
 $mode=New-Object BogunMonitorProbe+DM;$mode.size=220
 if(-not [BogunMonitorProbe]::EnumDisplaySettings($adapter.name,-1,[ref]$mode)){continue}
 for($j=0;;$j++){
  $monitor=[BogunMonitorProbe]::Device();if(-not [BogunMonitorProbe]::EnumDisplayDevices($adapter.name,$j,[ref]$monitor,1)){break}
  if(($monitor.flags-band 1)-eq 0){continue}
  $rows+=[pscustomobject]@{path=$monitor.id;label=$monitor.label;x=$mode.x;y=$mode.y;width=$mode.width;height=$mode.height}
 }
}
ConvertTo-Json -InputObject @($rows) -Compress
`;
export interface NativeMonitor {readonly path:string;readonly label:string;readonly x:number;readonly y:number;readonly width:number;readonly height:number;}
export function parseNativeMonitors(value:unknown):readonly NativeMonitor[]{
 if(!Array.isArray(value)||value.length>32)throw new Error('Invalid monitor inventory');
 return value.map((row:unknown)=>{
  if(typeof row!=='object'||row===null||!('path'in row)||typeof row.path!=='string'||!row.path||row.path.length>1024||!('label'in row)||typeof row.label!=='string'||row.label.length>256)throw new Error('Invalid monitor descriptor');
  if(!('x'in row)||!Number.isSafeInteger(row.x)||!('y'in row)||!Number.isSafeInteger(row.y)||!('width'in row)||!Number.isSafeInteger(row.width)||Number(row.width)<=0||!('height'in row)||!Number.isSafeInteger(row.height)||Number(row.height)<=0)throw new Error('Invalid monitor pixels');
  return {path:row.path,label:row.label,x:Number(row.x),y:Number(row.y),width:Number(row.width),height:Number(row.height)};
 });
}
export async function readNativeMonitors():Promise<readonly NativeMonitor[]>{
 if(process.platform!=='win32')return [];
 const exe=join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 const text=await new Promise<string>((resolve,reject)=>execFile(exe,['-NoProfile','-NonInteractive','-Command',monitorProbeScript],{windowsHide:true,timeout:8000,maxBuffer:131072,encoding:'utf8'},(error,stdout)=>{if(error)reject(new Error('Windows monitor identity unavailable'));else resolve(stdout);}));
 return parseNativeMonitors(JSON.parse(text.replace(/^\uFEFF/,'')));
}
export function observeMonitors(displays:readonly Pick<Display,'id'|'label'|'bounds'|'workArea'|'scaleFactor'>[],primaryId:number,native:readonly NativeMonitor[],physicalPoint:(point:Point)=>Point,machine=hostname()):readonly MonitorObservation[]{
 return displays.map(display=>{
  const origin=physicalPoint({x:display.bounds.x,y:display.bounds.y});
  const matches=native.filter(row=>row.x===origin.x&&row.y===origin.y&&Math.abs(row.width-display.bounds.width*display.scaleFactor)<=2&&Math.abs(row.height-display.bounds.height*display.scaleFactor)<=2);
  const match=matches.length===1?matches[0]:undefined;
  const path=match?.path.toLowerCase();const model=path?.match(/display[\\#]([^\\#]+)/)?.[1];
  const identityKey=path&&model?createHash('sha256').update(JSON.stringify([machine.toLowerCase(),model,path])).digest('hex'):null;
  return {displayId:display.id,label:display.label||match?.label||'디스플레이',primary:display.id===primaryId,bounds:{...display.bounds},workArea:{...display.workArea},scaleFactor:display.scaleFactor,identityKey,identityKind:identityKey?'device-path':'uncertain'};
 });
}
