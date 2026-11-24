import type {AdminSystem} from './admin-protocol.js';

export const WORK_ACTION_CATEGORIES=[
 'leave','document','purchase-budget','student-health','training-education','common-system',
] as const;
export type WorkActionCategory=typeof WORK_ACTION_CATEGORIES[number];

export const WORK_ACTION_IDS=[
 'leave-annual','business-trip','overtime',
 'document-draft','document-approve','document-circulate','document-send','document-receive','document-box',
 'purchase-request','budget-status','expense-resolution',
 'student-health-record','health-check-results',
 'training-history','staff-training-guide',
 'open-portal','open-neis','open-edufine','open-evpn',
] as const;
export type WorkActionId=typeof WORK_ACTION_IDS[number];
export type WorkActionSystem=AdminSystem|'evpn';
export type WorkActionVerification='FIELD_VERIFIED'|'UNVERIFIED';
export type WorkAction=Readonly<{
 id:WorkActionId;
 category:WorkActionCategory;
 label:string;
 system:WorkActionSystem;
 verification:WorkActionVerification;
 manualPath?:readonly string[];
 observedMenuLabels?:readonly string[];
}>;

const observed=(operation:string):readonly string[]=>Object.freeze(['문서관리',operation]);
const manualPath=Object.freeze(['학교회계','사업관리','사업담당','품의/정산','품의등록']);

export const SMART_WORK_ACTIONS:readonly WorkAction[]=Object.freeze([
 Object.freeze({id:'leave-annual',category:'leave',label:'연가 신청',system:'neis',verification:'UNVERIFIED'}),
 Object.freeze({id:'business-trip',category:'leave',label:'출장 신청',system:'neis',verification:'UNVERIFIED'}),
 Object.freeze({id:'overtime',category:'leave',label:'시간외근무 신청',system:'neis',verification:'UNVERIFIED'}),
 Object.freeze({id:'document-draft',category:'document',label:'기안',system:'edufine',verification:'UNVERIFIED',observedMenuLabels:observed('기안')}),
 Object.freeze({id:'document-approve',category:'document',label:'결재',system:'edufine',verification:'UNVERIFIED',observedMenuLabels:observed('결재')}),
 Object.freeze({id:'document-circulate',category:'document',label:'공람',system:'edufine',verification:'UNVERIFIED',observedMenuLabels:observed('공람')}),
 Object.freeze({id:'document-send',category:'document',label:'발송',system:'edufine',verification:'UNVERIFIED',observedMenuLabels:observed('발송')}),
 Object.freeze({id:'document-receive',category:'document',label:'접수',system:'edufine',verification:'UNVERIFIED',observedMenuLabels:observed('접수')}),
 Object.freeze({id:'document-box',category:'document',label:'문서함',system:'edufine',verification:'UNVERIFIED',observedMenuLabels:observed('문서함')}),
 Object.freeze({id:'purchase-request',category:'purchase-budget',label:'물품 구매 품의',system:'edufine',verification:'FIELD_VERIFIED',manualPath}),
 Object.freeze({id:'budget-status',category:'purchase-budget',label:'예산 현황 확인',system:'edufine',verification:'UNVERIFIED'}),
 Object.freeze({id:'expense-resolution',category:'purchase-budget',label:'지출결의 확인',system:'edufine',verification:'UNVERIFIED'}),
 Object.freeze({id:'student-health-record',category:'student-health',label:'학생 건강기록 확인',system:'neis',verification:'UNVERIFIED'}),
 Object.freeze({id:'health-check-results',category:'student-health',label:'건강검사 결과 확인',system:'neis',verification:'UNVERIFIED'}),
 Object.freeze({id:'training-history',category:'training-education',label:'연수 이수 내역 확인',system:'portal',verification:'UNVERIFIED'}),
 Object.freeze({id:'staff-training-guide',category:'training-education',label:'교직원 연수 안내 확인',system:'portal',verification:'UNVERIFIED'}),
 Object.freeze({id:'open-portal',category:'common-system',label:'업무포털 열기',system:'portal',verification:'UNVERIFIED'}),
 Object.freeze({id:'open-neis',category:'common-system',label:'나이스 열기',system:'neis',verification:'UNVERIFIED'}),
 Object.freeze({id:'open-edufine',category:'common-system',label:'K-에듀파인 열기',system:'edufine',verification:'UNVERIFIED'}),
 Object.freeze({id:'open-evpn',category:'common-system',label:'eVPN 접속',system:'evpn',verification:'UNVERIFIED'}),
] satisfies readonly WorkAction[]);

const idSet:ReadonlySet<string>=new Set(WORK_ACTION_IDS);
const categorySet:ReadonlySet<string>=new Set(WORK_ACTION_CATEGORIES);
const systemSet:ReadonlySet<string>=new Set(['portal','neis','edufine','evpn']);
const object=(value:unknown):value is Readonly<Record<string,unknown>>=>typeof value==='object'&&value!==null&&!Array.isArray(value);

export function validateWorkActionId(value:unknown):WorkActionId{
 if(typeof value!=='string'||!idSet.has(value))throw new RangeError('알 수 없는 업무 ID입니다.');
 for(const id of WORK_ACTION_IDS)if(id===value)return id;
 throw new RangeError('알 수 없는 업무 ID입니다.');
}

export function validateWorkActionCategory(value:unknown):WorkActionCategory{
 if(typeof value!=='string'||!categorySet.has(value))throw new RangeError('알 수 없는 업무 분류입니다.');
 for(const category of WORK_ACTION_CATEGORIES)if(category===value)return category;
 throw new RangeError('알 수 없는 업무 분류입니다.');
}

export function validateWorkActionCatalog(values:readonly unknown[]):void{
 const ids=new Set<WorkActionId>();
 for(const value of values){
  if(!object(value))throw new RangeError('업무 항목 형식이 올바르지 않습니다.');
  const id=validateWorkActionId(value['id']);
  validateWorkActionCategory(value['category']);
  if(typeof value['label']!=='string'||value['label'].trim()===''||typeof value['system']!=='string'||!systemSet.has(value['system']))throw new RangeError('업무 항목 형식이 올바르지 않습니다.');
  if(value['verification']!=='FIELD_VERIFIED'&&value['verification']!=='UNVERIFIED')throw new RangeError('업무 검증 상태가 올바르지 않습니다.');
  if(value['verification']==='UNVERIFIED'&&Object.prototype.hasOwnProperty.call(value,'manualPath'))throw new RangeError('검증되지 않은 업무에는 수동 경로를 둘 수 없습니다.');
  if(value['verification']==='FIELD_VERIFIED'&&(!Array.isArray(value['manualPath'])||!value['manualPath'].every(part=>typeof part==='string'&&part.trim()!=='')))throw new RangeError('현장 검증 업무의 수동 경로가 올바르지 않습니다.');
  if(ids.has(id))throw new RangeError('중복 업무 ID입니다.');
  ids.add(id);
 }
}

export function findWorkAction(value:unknown):WorkAction|undefined{
 if(typeof value!=='string'||!idSet.has(value))return undefined;
 return SMART_WORK_ACTIONS.find(action=>action.id===value);
}

export function filterWorkActions(category:WorkActionCategory):readonly WorkAction[]{
 return Object.freeze(SMART_WORK_ACTIONS.filter(action=>action.category===category));
}

export function searchWorkActions(query:string,category?:WorkActionCategory):readonly WorkAction[]{
 const normalized=query.trim().replace(/\s+/g,' ').toLocaleLowerCase('ko-KR');
 const candidates=category===undefined?SMART_WORK_ACTIONS:filterWorkActions(category);
 if(normalized==='')return Object.freeze([...candidates]);
 return Object.freeze(candidates.filter(action=>[
  action.id,action.label,action.system,...(action.observedMenuLabels??[]),...(action.manualPath??[]),
 ].join(' ').toLocaleLowerCase('ko-KR').includes(normalized)));
}

validateWorkActionCatalog(SMART_WORK_ACTIONS);
