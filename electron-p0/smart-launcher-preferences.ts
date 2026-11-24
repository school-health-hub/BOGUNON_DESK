import {validateWorkActionId,type WorkActionId} from './smart-work-launcher.js';

export type SmartLauncherRecent=Readonly<{id:WorkActionId;timestamp:string}>;
export type SmartLauncherPreferences=Readonly<{
  version:1;
  revision:number;
  favorites:readonly WorkActionId[];
  recentEnabled:boolean;
  recent:readonly SmartLauncherRecent[];
}>;
export type SmartLauncherPreferencesLoad=Readonly<{document:SmartLauncherPreferences;recovered:boolean}>;
export type SmartLauncherRecordResult=Readonly<{load:SmartLauncherPreferencesLoad;recorded:boolean}>;

export const emptySmartLauncherPreferences=():SmartLauncherPreferences=>({
  version:1,revision:0,favorites:[],recentEnabled:false,recent:[],
});

const strictRecord=(value:unknown,allowed:readonly string[]):value is Record<string,unknown>=>{
  if(value===null||typeof value!=='object'||Array.isArray(value))return false;
  const actual=Object.keys(value).sort(),expected=[...allowed].sort();
  return actual.length===expected.length&&actual.every((key,index)=>key===expected[index]);
};

const parseId=(value:unknown):WorkActionId=>validateWorkActionId(value);

const parseTimestamp=(value:unknown):string=>{
  if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/.test(value))throw new Error('Invalid smart launcher timestamp');
  const parsed=new Date(value);if(Number.isNaN(parsed.valueOf())||parsed.toISOString()!==value)throw new Error('Invalid smart launcher timestamp');
  return value;
};

export function validateSmartLauncherPreferences(value:unknown):SmartLauncherPreferences{
  if(!strictRecord(value,['version','revision','favorites','recentEnabled','recent'])||value.version!==1||!Number.isSafeInteger(value.revision)||Number(value.revision)<0||!Array.isArray(value.favorites)||value.favorites.length>12||typeof value.recentEnabled!=='boolean'||!Array.isArray(value.recent)||value.recent.length>10)throw new Error('Invalid smart launcher preferences');
  const favorites=value.favorites.map(parseId);
  if(new Set(favorites).size!==favorites.length)throw new Error('Duplicate smart launcher favorite');
  const recent=value.recent.map(entry=>{
    if(!strictRecord(entry,['id','timestamp']))throw new Error('Invalid smart launcher recent entry');
    return {id:parseId(entry.id),timestamp:parseTimestamp(entry.timestamp)};
  });
  return structuredClone({version:1,revision:Number(value.revision),favorites,recentEnabled:value.recentEnabled,recent});
}
