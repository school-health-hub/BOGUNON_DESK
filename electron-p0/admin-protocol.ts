import type {IpcResult,PurchaseExportResult} from './protocol.js';
export const ADMIN_SYSTEMS={portal:'업무포털',neis:'나이스',edufine:'K-에듀파인'} as const;
export const LEAVE_KINDS=['연가','조퇴','출장','시간외근무'] as const;
export type AdminSystem=keyof typeof ADMIN_SYSTEMS;
export const ADMIN_ENVIRONMENTS={school:'학교망',evpn:'eVPN'} as const;
export type AdminEnvironment=keyof typeof ADMIN_ENVIRONMENTS;
export type AdminAddresses=Readonly<Record<AdminSystem,string>>;
export type AdminLauncher=Readonly<{environment:AdminEnvironment;evpn:AdminAddresses;entryUrl?:string}>;
export type LeaveDraft=Readonly<{id:string;system:AdminSystem;kind:typeof LEAVE_KINDS[number];startDate:string;endDate:string;startTime:string;endTime:string;reason:string;text:string}>;
export type AdminDocument=Readonly<{version:1;revision:number;systems:AdminAddresses;launcher?:AdminLauncher;templates:Readonly<Record<AdminSystem,string>>;drafts:readonly LeaveDraft[]}>;
const DEFAULT_TEMPLATE='[{{유형}} 신청 검토용 초안]\n기간: {{시작일}} {{시작시간}} ~ {{종료일}} {{종료시간}}\n사유: {{사유}}\n\n기관 양식과 복무 규정을 확인한 뒤 직접 입력해 주세요.';
export const emptyAdmin=():AdminDocument=>({version:1,revision:0,systems:{portal:'',neis:'',edufine:''},templates:{portal:DEFAULT_TEMPLATE,neis:DEFAULT_TEMPLATE,edufine:DEFAULT_TEMPLATE},drafts:[]});
// Legacy systems remain the school profile. No write/migration takes place on read.
export const adminEnvironment=(document:AdminDocument):AdminEnvironment=>document.launcher?.environment??'school';
export const adminAddresses=(document:AdminDocument,environment:AdminEnvironment=adminEnvironment(document)):AdminAddresses=>environment==='school'?document.systems:(document.launcher?.evpn??{portal:'',neis:'',edufine:''});
export function withAdminEnvironment(document:AdminDocument,environment:AdminEnvironment):AdminDocument{
 if(!Object.prototype.hasOwnProperty.call(ADMIN_ENVIRONMENTS,environment))throw Error('학교망 또는 eVPN을 선택해 주세요.');
 return {...document,launcher:{...document.launcher,environment,evpn:adminAddresses(document,'evpn')}};
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:unknown,allowed:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).sort().join(',')===allowed.sort().join(',');
const text=(v:unknown,max:number,required=true):v is string=>typeof v==='string'&&v.length<=max&&(!required||!!v.trim())&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
export const authSecret=/(?:비밀번호|password|api[ _-]?key|access[ _-]?token|refresh[ _-]?token)\s*[:=]\s*\S+|\bBearer\s+[A-Za-z0-9._-]+|\bsk-[A-Za-z0-9_-]{20,}/i;
// Gyeongbuk eVPN is the exact official exception; do not allow arbitrary *.gbe.kr.
export function officialAdminUrl(value:string):string{
 if(!text(value,2000))throw Error('공식 HTTPS 기본 주소를 입력해 주세요.');
 let url:URL;try{url=new URL(value);}catch{throw Error('공식 HTTPS 주소 형식을 확인해 주세요.');}
 if(url.protocol!=='https:'||url.port||url.username||url.password||url.search||url.hash||!/^[a-z0-9.-]+$/.test(url.hostname)||!(url.hostname==='evpn.gbe.kr'||['go.kr','edu.kr','eduptl.kr','k-eduplus.kr'].some(domain=>url.hostname.endsWith('.'+domain)||['eduptl.kr','k-eduplus.kr'].includes(domain)&&url.hostname===domain)))throw Error('기관 공식 HTTPS 기본 주소만 지원합니다. 계정·토큰·검색 매개변수가 포함된 주소는 저장하지 않습니다.');
 return url.href;
}
// Stricter execution boundary, deliberately separate from legacy JSON validation.
export function safeAdminLaunchUrl(value:string):string{
 if(value!==value.trim()||/[\u0000-\u0020\u007f\\]/.test(value)||/%(?:0[0-9a-f]|1[0-9a-f]|7f|2f|5c)/i.test(value))throw Error('실행할 HTTPS 주소를 확인해 주세요. 제어문자·역슬래시·인코딩된 경로 구분자는 지원하지 않습니다.');
 const canonical=officialAdminUrl(value),url=new URL(canonical);if(url.hostname.length>253||url.hostname.split('.').some(label=>!/^([a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/.test(label)))throw Error('기관 호스트 이름을 확인해 주세요.');return canonical;
}
export function validAdminDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number(value.slice(0,4))>=1900&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
const tokens=['유형','시작일','종료일','시작시간','종료시간','사유'];
export function validateAdminTemplate(value:unknown):string{
 if(!text(value,4000)||authSecret.test(value))throw Error('인증정보 없이 4,000자 이내의 양식을 입력해 주세요.');
 const rest=value.replace(/\{\{([^{}]+)\}\}/g,(_match,key:string)=>{if(!tokens.includes(key))throw Error('지원하지 않는 양식 항목입니다.');return '';});
 if(rest.includes('{{')||rest.includes('}}'))throw Error('양식 괄호를 확인해 주세요.');return value;
}
export function validateLeaveDraft(value:unknown):LeaveDraft{
 if(!keys(value,['id','system','kind','startDate','endDate','startTime','endTime','reason','text'])||!text(value.id,100)||!Object.prototype.hasOwnProperty.call(ADMIN_SYSTEMS,String(value.system))||!LEAVE_KINDS.includes(value.kind as LeaveDraft['kind'])||!text(value.startDate,10)||!text(value.endDate,10)||!validAdminDate(value.startDate)||!validAdminDate(value.endDate)||typeof value.startTime!=='string'||typeof value.endTime!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.endTime)||`${value.startDate}T${value.startTime}`>=`${value.endDate}T${value.endTime}`||!text(value.reason,1000)||!text(value.text,8000)||authSecret.test(value.reason+'\n'+value.text))throw Error('복무 유형·기간·시간·사유·검토 내용을 확인해 주세요. 인증정보는 저장하지 않습니다.');
 return structuredClone(value) as LeaveDraft;
}
export function renderLeaveDraft(template:string,draft:Omit<LeaveDraft,'text'>){
 const fields={유형:draft.kind,시작일:draft.startDate,종료일:draft.endDate,시작시간:draft.startTime,종료시간:draft.endTime,사유:draft.reason};
 const result=validateAdminTemplate(template).replace(/\{\{([^{}]+)\}\}/g,(_match,key:keyof typeof fields)=>fields[key]);validateLeaveDraft({...draft,text:result});return result;
}
export function validateAdminDocument(value:unknown):AdminDocument{
 if(!keys(value,['version','revision','systems','templates','drafts',...(object(value)&&Object.prototype.hasOwnProperty.call(value,'launcher')?['launcher']:[])])||value.version!==1||!Number.isSafeInteger(value.revision)||Number(value.revision)<0||!keys(value.systems,Object.keys(ADMIN_SYSTEMS))||!keys(value.templates,Object.keys(ADMIN_SYSTEMS))||!Array.isArray(value.drafts)||value.drafts.length>200)throw Error('학교 행정 저장 형식을 확인해 주세요.');
 if(Object.prototype.hasOwnProperty.call(value,'launcher')){
  if(!keys(value.launcher,['environment','evpn',...(object(value.launcher)&&Object.prototype.hasOwnProperty.call(value.launcher,'entryUrl')?['entryUrl']:[])])||typeof value.launcher.environment!=='string'||!Object.prototype.hasOwnProperty.call(ADMIN_ENVIRONMENTS,value.launcher.environment)||!keys(value.launcher.evpn,Object.keys(ADMIN_SYSTEMS)))throw Error('학교망/eVPN 설정 형식을 확인해 주세요.');
  if(Object.prototype.hasOwnProperty.call(value.launcher,'entryUrl')&&(typeof value.launcher.entryUrl!=='string'||value.launcher.entryUrl!==''&&officialAdminUrl(value.launcher.entryUrl)!==value.launcher.entryUrl))throw Error('eVPN 접속 주소를 확인해 주세요.');
  for(const url of Object.values(value.launcher.evpn))if(typeof url!=='string'||url!==''&&officialAdminUrl(url)!==url)throw Error('eVPN 공식 주소를 확인해 주세요.');
 }
 for(const key of Object.keys(ADMIN_SYSTEMS)){const url=value.systems[key];if(typeof url!=='string'||url!==''&&officialAdminUrl(url)!==url)throw Error('공식 주소를 확인해 주세요.');validateAdminTemplate(value.templates[key]);}
 const ids=new Set<string>();for(const draft of value.drafts){const parsed=validateLeaveDraft(draft);if(ids.has(parsed.id))throw Error('중복 초안입니다.');ids.add(parsed.id);}
 if(new TextEncoder().encode(JSON.stringify(value)).length>2*1024*1024)throw Error('저장 크기 제한을 초과했습니다.');return structuredClone(value) as AdminDocument;
}
export type AdminLoad=Readonly<{document:AdminDocument;recovered:boolean}>;
export type AdminTable=Readonly<{generation:number;sourceName:string;sheetName:string;rows:readonly (readonly string[])[]}>;
export type AdminColumn=Readonly<{label:string;sourceColumn:number;type:'text'|'number'|'date';required:boolean}>;
export type AdminReview=Readonly<{id:string;generation:number;headers:readonly string[];rows:readonly Readonly<{sourceRow:number;values:readonly string[];issues:readonly string[]}>[]}>;
export type AdminMapping=Readonly<{generation:number;headerRow:number;columns:readonly AdminColumn[]}>;
export type AdminSelection=Readonly<{reviewId:string;rowIndexes:readonly number[]}>;
export type AdminLaunchResult=Readonly<{status:'launched'|'canceled'|'blocked';connection?:import('./admin-connection.js').AdminConnectionCheck}>;
export type AdminBridge=Readonly<{
 close():Promise<IpcResult<null>>;load():Promise<IpcResult<AdminLoad>>;save(document:AdminDocument,expectedRevision:number):Promise<IpcResult<AdminLoad>>;
 openEvpn():Promise<IpcResult<AdminLaunchResult|Readonly<{status:'needs-configuration'}>>>;
 checkSystem?(system:AdminSystem|'evpn'):Promise<IpcResult<import('./admin-connection.js').AdminConnectionCheck|Readonly<{state:'needs-configuration';message:string}>>>;
 setEnvironment(environment:AdminEnvironment,expectedRevision:number):Promise<IpcResult<AdminLoad>>;
 openSystem(system:AdminSystem):Promise<IpcResult<AdminLaunchResult|Readonly<{status:'needs-configuration';system:AdminSystem;environment:AdminEnvironment}>>>;
 copyDraft(draft:LeaveDraft):Promise<IpcResult<Readonly<{copied:boolean}>>>;
 pickTable():Promise<IpcResult<AdminTable|null>>;cancel():Promise<IpcResult<null>>;
 mapTable(input:AdminMapping):Promise<IpcResult<AdminReview>>;
 copyRows(input:AdminSelection):Promise<IpcResult<Readonly<{copied:boolean}>>>;
 exportRows(input:AdminSelection):Promise<IpcResult<PurchaseExportResult>>;
}>;
