import type {IpcResult} from './protocol.js';
import type {AdminEnvironment,AdminSystem} from './admin-protocol.js';
// Same four-field DTO as src/school-info/types.ts; kept within Electron's runtime root.
// A compile-time contract test checks equivalence without importing Tauri/Supabase.
export type SchoolInfo=Readonly<{officeCode:string;officeName:string;schoolCode:string;schoolName:string}>;
export const EDUCATION_OFFICES={B10:'서울특별시교육청',C10:'부산광역시교육청',D10:'대구광역시교육청',E10:'인천광역시교육청',F10:'광주광역시교육청',G10:'대전광역시교육청',H10:'울산광역시교육청',I10:'세종특별자치시교육청',J10:'경기도교육청',K10:'강원특별자치도교육청',M10:'충청북도교육청',N10:'충청남도교육청',P10:'전북특별자치도교육청',Q10:'전라남도교육청',R10:'경상북도교육청',S10:'경상남도교육청',T10:'제주특별자치도교육청'} as const;
export type OfficeCode=keyof typeof EDUCATION_OFFICES;
export type VerifiedSchoolUrl=Readonly<{url:string;evidence:string;verifiedOn:string}>;
export type OfficeUrls=Readonly<Record<AdminEnvironment,Readonly<Partial<Record<AdminSystem|'evpn',VerifiedSchoolUrl>>>>>;
// Do not generate operational URLs from office codes or host-name patterns.
// No office URL has a reviewed official source in this checkpoint. Missing entries require user registration.
export const OFFICE_LAUNCHER_URLS:Readonly<Record<OfficeCode,OfficeUrls>>=Object.freeze(Object.fromEntries(Object.keys(EDUCATION_OFFICES).map(code=>[code,Object.freeze({school:Object.freeze({}),evpn:Object.freeze({})})])) as Record<OfficeCode,OfficeUrls>);
export type SchoolDocument=Readonly<{version:1;revision:number;school:SchoolInfo|null}>;
export type SchoolLoad=Readonly<{document:SchoolDocument;recovered:boolean;bogunon:'unavailable'}>;
export type SchoolQuery=Readonly<{name:string;officeCode:OfficeCode|''}>;
export type SchoolCandidate=Readonly<{school:SchoolInfo;kind:string;location:string}>;
export type SchoolSearch=Readonly<{searchId:string;results:readonly SchoolCandidate[];limited:true}>;
export type SchoolSelection=Readonly<{searchId:string;officeCode:string;schoolCode:string;expectedRevision:number}>;
export type SchoolBridge=Readonly<{load():Promise<IpcResult<SchoolLoad>>;search(query:SchoolQuery):Promise<IpcResult<SchoolSearch>>;select(input:SchoolSelection):Promise<IpcResult<SchoolLoad>>;cancel():Promise<IpcResult<null>>}>;
export const emptySchool=():SchoolDocument=>({version:1,revision:0,school:null});
export const schoolObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const schoolKeys=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>schoolObject(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export const schoolText=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&v===v.trim()&&!/[\u0000-\u001f\u007f<>]/.test(v);
export function validateSchool(value:unknown):SchoolInfo{
 if(!schoolKeys(value,['officeCode','officeName','schoolCode','schoolName'])||typeof value.officeCode!=='string'||!Object.prototype.hasOwnProperty.call(EDUCATION_OFFICES,value.officeCode)||!schoolText(value.officeName,100)||typeof value.schoolCode!=='string'||!/^\d{7}$/.test(value.schoolCode)||!schoolText(value.schoolName,150))throw Error('학교 정보 형식을 확인해 주세요.');
 return structuredClone(value) as SchoolInfo;
}
export function validateSchoolDocument(value:unknown):SchoolDocument{
 if(!schoolKeys(value,['version','revision','school'])||value.version!==1||!Number.isSafeInteger(value.revision)||Number(value.revision)<0)throw Error('학교 프로필 형식을 확인해 주세요.');
 if(value.school!==null)validateSchool(value.school);
 return structuredClone(value) as SchoolDocument;
}
export function validateSchoolQuery(value:unknown):SchoolQuery{
 if(!schoolKeys(value,['name','officeCode'])||!schoolText(value.name,60)||value.name.length<2||!/^[-가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ().·]+$/.test(value.name)||typeof value.officeCode!=='string'||value.officeCode!==''&&!Object.prototype.hasOwnProperty.call(EDUCATION_OFFICES,value.officeCode))throw Error('학교명 2~60자와 교육청을 확인해 주세요. 학교 이름만 입력하세요.');
 return value as SchoolQuery;
}
