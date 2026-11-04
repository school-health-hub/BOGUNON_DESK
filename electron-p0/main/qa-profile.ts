import {isAbsolute,join,relative,resolve,sep} from 'node:path';
// Explicit QA opt-in only. Default user profiles and legacy UUID tests stay unchanged.
export function qaProfilePaths(input:{enabled?:string;root?:string;runId?:string;tempRoot:string;defaultAppData:string;profileName:string}){
 const {enabled,root,runId,tempRoot,defaultAppData,profileName}=input;
 if(root||enabled){
  if(enabled!=='1'||!root||!runId||!/^[a-f0-9-]{36}$/.test(runId)||!isAbsolute(root)||!isAbsolute(tempRoot))throw Error('Invalid explicit QA profile configuration');
  const base=resolve(tempRoot),target=resolve(root),rel=relative(base,target);
  if(!rel||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))throw Error('QA profile must be strictly inside the approved temporary root');
  const protectedRoot=resolve(defaultAppData,profileName);
  const overlap=(a:string,b:string)=>{const r=relative(a,b);return !r||r!=='..'&&!r.startsWith('..'+sep)&&!isAbsolute(r);};
  if(overlap(protectedRoot,target)||overlap(target,protectedRoot))throw Error('QA profile overlaps the default user profile');
  const userData=join(target,'test-runs',runId,'user-data');
  return {qa:true,root:target,appData:join(target,'app-data'),userData,sessionData:join(userData,'chromium')};
 }
 const userData=runId?join(defaultAppData,profileName,'test-runs',runId):join(defaultAppData,profileName);
 return {qa:false,root:undefined,appData:defaultAppData,userData,sessionData:join(userData,'chromium')};
}
