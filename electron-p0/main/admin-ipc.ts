import {adminNetworkGuide,type AdminConnectionCheck} from '../admin-connection.js';
import {basename,extname,isAbsolute,relative,sep} from 'node:path';
import {assertSender} from './policy.js';import {AdminStore,AdminConflict} from './admin-store.js';
import {ADMIN_SYSTEMS,ADMIN_ENVIRONMENTS,adminEnvironment,adminAddresses,safeAdminLaunchUrl,validateAdminDocument,validateLeaveDraft,type AdminSystem,type AdminTable,type AdminReview} from '../admin-protocol.js';
import type {IpcResult} from '../protocol.js';
import {csvRows,decodeCsv} from './purchase-csv.js';import {readSelectedPurchaseFile} from './purchase-import.js';import {writeSelectedExport,ExportConflict} from './purchase-export-storage.js';
import {mapAdminTable,selectAdminRows,validateAdminRows} from './admin-table.js';
import type {ExcelService} from './purchase-excel.js';
class AdminActionError extends Error{}
export type AdminPorts={store:AdminStore;excel:Pick<ExcelService,'table'|'review'>;protectedRoot:string;pick:()=>Promise<string|undefined>;save:()=>Promise<string|undefined>;openExternal:(url:string)=>Promise<void>;copy:(text:string)=>Promise<void>;review:(message:string,text:string)=>Promise<boolean>;inspect?:(url:string,signal:AbortSignal)=>Promise<AdminConnectionCheck>;school?:()=>Promise<import('../school-protocol.js').SchoolInfo|null>;write?:typeof writeSelectedExport;read?:typeof readSelectedPurchaseFile};
export function createAdminHandlers(contents:Parameters<typeof assertSender>[1],url:string,ports:AdminPorts){
 let generation=0,busy=false,table:AdminTable|undefined,review:AdminReview|undefined,controller:AbortController|undefined;
 const fresh=(event:Parameters<typeof assertSender>[0],token:number)=>{assertSender(event,contents,url);if(token!==generation||controller?.signal.aborted)throw Error('Canceled');};
 const failure=(code:'FORBIDDEN'|'INVALID_INPUT'|'STORAGE_ERROR'|'CONFLICT'='STORAGE_ERROR'):IpcResult<never>=>({ok:false,error:{code,message:code==='CONFLICT'?'저장 대상 또는 설정이 변경됐습니다. 다시 불러와 확인해 주세요.':'학교 행정 작업을 완료하지 못했습니다. 기존 파일·초안·표는 유지합니다. 주소·입력 형식·파일 제한을 확인해 주세요.',retryable:code!=='FORBIDDEN'}});
 const run=(count:number,operation:(args:unknown[],event:Parameters<typeof assertSender>[0],token:number)=>Promise<unknown>,exclusive=false)=>async(event:Parameters<typeof assertSender>[0],...args:unknown[]):Promise<IpcResult<unknown>>=>{
  try{assertSender(event,contents,url);}catch{return failure('FORBIDDEN');}if(args.length!==count)return failure('INVALID_INPUT');if(exclusive&&busy)return failure('INVALID_INPUT');
  if(exclusive){busy=true;controller=new AbortController();}const token=generation;
  try{return {ok:true,data:await operation(args,event,token)};}catch(error){if(token!==generation)return {ok:false,error:{code:'INTERNAL_ERROR',message:'처리를 취소했습니다. 이미 완료된 저장·복사는 되돌리지 않습니다. 기존 초안·표는 유지합니다.',retryable:false}};if(error instanceof AdminActionError)return {ok:false,error:{code:'INTERNAL_ERROR',message:error.message,retryable:true}};return failure(error instanceof AdminConflict||error instanceof ExportConflict?'CONFLICT':'STORAGE_ERROR');}finally{if(exclusive){busy=false;controller=undefined;}}
 };
 const reset=()=>{generation++;controller?.abort();};
 const confirm=async(event:Parameters<typeof assertSender>[0],token:number,message:string,text:string)=>{const approved=await ports.review(message,text);fresh(event,token);return approved;};
 const schoolIdentity=async()=>{const school=await ports.school?.();return school?`${school.officeCode} / ${school.schoolCode} · ${school.schoolName}`:'학교 프로필 미선택';};
 const inspectLaunch=async(event:Parameters<typeof assertSender>[0],token:number,target:string):Promise<AdminConnectionCheck|undefined>=>{
  if(!ports.inspect)return undefined;const checked=await ports.inspect(target,controller!.signal);fresh(event,token);return checked;
 };
 const consentForCheck=async(event:Parameters<typeof assertSender>[0],token:number,checked:AdminConnectionCheck|undefined)=>{
  if(!checked)return true;if(['redirect-blocked','redirect-limit'].includes(checked.state))return false;
  if(checked.state==='reachable'||checked.state==='authentication-required')return true;
  return confirm(event,token,'자동 확인이 완료되지 않았습니다. 등록한 원래 주소를 브라우저에서 직접 확인할까요?',checked.message+(checked.redirectOrigin?'\n이동 요청 도메인: '+checked.redirectOrigin:'')+'\n인증정보를 보내거나 리디렉션 대상을 Main에서 따라가지 않습니다. 브라우저의 후속 이동은 앱에서 제어하지 못합니다.');
 };
 return {
  load:run(0,()=>ports.store.load()),
  setEnvironment:run(2,async args=>ports.store.setEnvironment(args[0],args[1])),
  save:run(2,async args=>{const next=validateAdminDocument(args[0]),current=(await ports.store.load()).document;for(const environment of ['school','evpn'] as const)for(const system of Object.keys(ADMIN_SYSTEMS) as AdminSystem[]){const target=adminAddresses(next,environment)[system];if(target&&target!==adminAddresses(current,environment)[system])safeAdminLaunchUrl(target);}if(next.launcher?.entryUrl&&next.launcher.entryUrl!==current.launcher?.entryUrl)safeAdminLaunchUrl(next.launcher.entryUrl);return ports.store.save(next,args[1]);}),
  openSystem:run(1,async(args,event,token)=>{
   if(typeof args[0]!=='string'||!Object.hasOwn(ADMIN_SYSTEMS,args[0]))throw Error();
   const system=args[0] as AdminSystem,current=await ports.store.load(),environment=adminEnvironment(current.document),address=adminAddresses(current.document,environment)[system];
   fresh(event,token);if(!address)return {status:'needs-configuration',system,environment};
   const target=safeAdminLaunchUrl(address),school=await schoolIdentity();fresh(event,token);
   if(!await confirm(event,token,`${ADMIN_ENVIRONMENTS[environment]} · ${ADMIN_SYSTEMS[system]} 공식 주소를 기본 브라우저로 열까요?`,target+'\n'+school+'\n'+adminNetworkGuide(environment)+'\n사용자 등록 주소입니다. 도메인 형식 검사만으로 공식 출처를 보증하지 않습니다. 비로그인 HEAD 확인 후 기본 브라우저 실행을 요청합니다. 인증서·비밀번호는 저장하지 않습니다.'))return {status:'canceled'};
   const connection=await inspectLaunch(event,token,target);if(!await consentForCheck(event,token,connection))return {status:connection&&['redirect-blocked','redirect-limit'].includes(connection.state)?'blocked':'canceled',...(connection?{connection}:{})};
   if(await schoolIdentity()!==school)throw new AdminActionError('학교 프로필이 변경되었습니다. 현재 학교와 주소를 다시 확인해 주세요.');const latest=(await ports.store.load()).document;fresh(event,token);
   if(adminEnvironment(latest)!==environment||adminAddresses(latest,environment)[system]!==target)throw new AdminActionError('선택 환경 또는 주소가 변경되어 실행하지 않았습니다. 현재 설정을 확인하고 다시 열어 주세요.');
   try{await ports.openExternal(target);}catch{throw new AdminActionError(`${ADMIN_ENVIRONMENTS[environment]} · ${ADMIN_SYSTEMS[system]} 브라우저 실행 요청에 실패했습니다. 등록 주소와 기본 브라우저를 확인하세요. 접속·로그인 오류는 해당 시스템 안내를 확인해 주세요.`);}fresh(event,token);return {status:'launched',...(connection?{connection}:{})};
  },true),
  openEvpn:run(0,async(_args,event,token)=>{
   const current=(await ports.store.load()).document,address=current.launcher?.entryUrl;fresh(event,token);if(!address)return {status:'needs-configuration'};
   const target=safeAdminLaunchUrl(address),school=await schoolIdentity();fresh(event,token);if(!await confirm(event,token,'등록한 eVPN 공식 접속 주소를 기본 브라우저로 열까요?',target+'\n'+school+'\n'+adminNetworkGuide('evpn')+'\n사용자 등록 주소의 공식 출처는 직접 대조하세요. 비로그인 HEAD 확인만 수행하며 인증서 로그인은 직접 진행합니다.'))return {status:'canceled'};
   const connection=await inspectLaunch(event,token,target);if(!await consentForCheck(event,token,connection))return {status:connection&&['redirect-blocked','redirect-limit'].includes(connection.state)?'blocked':'canceled',...(connection?{connection}:{})};
   if(await schoolIdentity()!==school)throw new AdminActionError('학교 프로필이 변경되었습니다. eVPN 주소를 다시 확인해 주세요.');const latest=(await ports.store.load()).document;fresh(event,token);if(latest.launcher?.entryUrl!==target)throw new AdminActionError('eVPN 접속 주소가 변경되었습니다. 다시 확인해 주세요.');
   try{await ports.openExternal(target);}catch{throw new AdminActionError('eVPN 브라우저 실행 요청에 실패했습니다. 기본 브라우저와 등록 주소를 확인하세요.');}fresh(event,token);return {status:'launched',...(connection?{connection}:{})};
  },true),
  checkSystem:run(1,async(args,event,token)=>{
   if(typeof args[0]!=='string'||!['evpn',...Object.keys(ADMIN_SYSTEMS)].includes(args[0]))throw Error();
   const current=(await ports.store.load()).document,target=args[0]==='evpn'?current.launcher?.entryUrl:adminAddresses(current)[args[0] as AdminSystem];fresh(event,token);
   if(!target)return {state:'needs-configuration',message:'선택 환경 주소가 없습니다. 기관 안내에서 확인한 주소를 등록하세요.'};
   if(!ports.inspect)throw new AdminActionError('이 실행본에는 비로그인 주소 확인 기능이 없습니다.');
   if(!await confirm(event,token,'등록한 주소에 비로그인 HEAD 요청으로 연결 상태만 확인할까요?',target+'\n쿠키·인증서·학교 정보·초안·표를 전송하지 않습니다. 원래 주소와 같은 출처의 HTTPS 이동만 제한적으로 확인합니다.'))return {state:'canceled',redirects:0,message:'주소 확인을 취소했습니다. 외부 요청하지 않았습니다.'};
   const latest=(await ports.store.load()).document;fresh(event,token);const latestTarget=args[0]==='evpn'?latest.launcher?.entryUrl:adminAddresses(latest)[args[0] as AdminSystem];if(latestTarget!==target||adminEnvironment(latest)!==adminEnvironment(current))throw new AdminActionError('주소 또는 환경이 변경되었습니다. 다시 확인해 주세요.');return inspectLaunch(event,token,safeAdminLaunchUrl(target));
  },true),
  copyDraft:run(1,async(args,event,token)=>{const draft=validateLeaveDraft(args[0]);if(!await confirm(event,token,'복무 초안을 확인하고 클립보드에 복사할까요?',draft.text))return {copied:false};await ports.copy(draft.text);return {copied:true};},true),
  pickTable:run(0,async(_args,event,token)=>{
   const path=await ports.pick();fresh(event,token);if(!path)return null;let rows:string[][],sheetName='CSV';
   if(extname(path).toLowerCase()==='.csv')rows=csvRows(decodeCsv(await (ports.read??readSelectedPurchaseFile)(path,['.csv'])));
   else if(extname(path).toLowerCase()==='.xlsx'){const result=await ports.excel.table(path,controller!.signal,value=>{const v=value as {sheetName:unknown;rows:unknown};if(!v||typeof v.sheetName!=='string'||v.sheetName.length>200)throw Error();return {sheetName:v.sheetName,rows:validateAdminRows(v.rows)};});rows=result.rows;sheetName=result.sheetName;}
   else throw Error();fresh(event,token);validateAdminRows(rows);table={generation:++generation,sourceName:basename(path),sheetName,rows};review=undefined;return table;
  },true),
  cancel:run(0,async()=>{reset();return null;}),
  mapTable:run(1,async args=>{if(!table)throw Error();review=mapAdminTable(table,args[0]);return review;}),
  copyRows:run(1,async(args,event,token)=>{if(!review)throw Error();const snapshot=review,rows=selectAdminRows(snapshot,args[0]);if(!await confirm(event,token,'선택 행을 검토용으로 복사할까요?',snapshot.headers.join(' · ')+`\n${rows.length}개 행 · 개인정보 포함 여부를 화면에서 검토해 주세요. 실제 시스템으로 전송하지 않습니다.`))return {copied:false};const output=await ports.excel.review(snapshot.headers,rows,controller!.signal,decodeReview);fresh(event,token);if(review!==snapshot)throw Error();await ports.copy(output.text);return {copied:true};},true),
  exportRows:run(1,async(args,event,token)=>{if(!review)throw Error();const snapshot=review,rows=selectAdminRows(snapshot,args[0]);if(!await confirm(event,token,'선택 행을 검토용 CSV로 저장할까요?',snapshot.headers.join(' · ')+`\n${rows.length}개 행 · 개인정보 포함 여부를 화면에서 검토해 주세요. 실제 시스템으로 전송하지 않습니다.`))return {status:'canceled'};
   const output=await ports.excel.review(snapshot.headers,rows,controller!.signal,decodeReview);fresh(event,token);const path=await ports.save();fresh(event,token);if(!path)return {status:'canceled'};const rel=relative(ports.protectedRoot,path);if(!isAbsolute(path)||extname(path).toLowerCase()!=='.csv'||!rel||rel!=='..'&&!rel.startsWith(`..${sep}`)&&!isAbsolute(rel))throw Error();
   return (ports.write??writeSelectedExport)(path,'csv',output.bytes,()=>confirm(event,token,'기존 CSV를 덮어쓸까요?','저장 직전 변경 여부를 다시 검사합니다.'),()=>{fresh(event,token);if(review!==snapshot)throw Error();});
  },true),
  close:run(0,async()=>{reset();table=undefined;review=undefined;return null;}),dispose:()=>{reset();table=undefined;review=undefined;},flush:()=>ports.store.flush(),
 };
}
function decodeReview(value:unknown){const v=value as {validated:unknown;bytesBase64:unknown;copyText:unknown};if(!v||v.validated!==true||typeof v.bytesBase64!=='string'||typeof v.copyText!=='string'||v.copyText.length>500000||v.copyText.includes('\0'))throw Error();const bytes=Buffer.from(v.bytesBase64,'base64');if(!bytes.length||bytes.length>2*1024*1024)throw Error();const records=csvRows(decodeCsv(bytes));if(!records.length)throw Error();if(records.map(row=>row.join('\t')).join('\r\n')!==v.copyText)throw Error();return {bytes,text:v.copyText};}
