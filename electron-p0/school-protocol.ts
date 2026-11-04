import type {IpcResult} from './protocol.js';
import type {AdminEnvironment,AdminSystem} from './admin-protocol.js';
// Same four-field DTO as src/school-info/types.ts; kept within Electron's runtime root.
// A compile-time contract test checks equivalence without importing Tauri/Supabase.
export type SchoolInfo=Readonly<{officeCode:string;officeName:string;schoolCode:string;schoolName:string}>;
export const EDUCATION_OFFICES={B10:'서울특별시교육청',C10:'부산광역시교육청',D10:'대구광역시교육청',E10:'인천광역시교육청',F10:'광주광역시교육청',G10:'대전광역시교육청',H10:'울산광역시교육청',I10:'세종특별자치시교육청',J10:'경기도교육청',K10:'강원특별자치도교육청',M10:'충청북도교육청',N10:'충청남도교육청',P10:'전북특별자치도교육청',Q10:'전라남도교육청',R10:'경상북도교육청',S10:'경상남도교육청',T10:'제주특별자치도교육청'} as const;
export type OfficeCode=keyof typeof EDUCATION_OFFICES;
export type VerifiedSchoolUrl=Readonly<{url:string;evidence:string;verifiedOn:string;verification?:'needs-official-confirmation'|'official-source-reviewed'}>;
export type OfficeUrls=Readonly<Record<AdminEnvironment,Readonly<Partial<Record<AdminSystem|'evpn',VerifiedSchoolUrl>>>>>;
// Initial values copied verbatim from the user's final 17-office table.
// Source registration does not verify network reachability or authentication.
// Gangwon (K10) remains explicitly pending official confirmation; do not substitute
// gwe or generate other URLs. This table has no K-Edufine entries.
const initial=(url:string,office:OfficeCode,kind:'portal'|'neis'|'evpn'):VerifiedSchoolUrl=>Object.freeze({
 url,
 evidence:office==='R10'&&kind==='evpn'?'https://www.gbe.kr/main/main.do':`사용자 제공 전국 접속 주소 표 · 공식 확인 필요${office==='K10'?' · 강원 주소 우선 확인':''}`,
 verifiedOn:office==='R10'&&kind==='evpn'?'2026-11-04':'',
 verification:office==='R10'&&kind==='evpn'?'official-source-reviewed':'needs-official-confirmation',
});
const INITIAL_OFFICE_URLS:Readonly<Record<OfficeCode,readonly [portal:string,neis:string,evpn:string]>>={
 B10:['https://sen.eduptl.kr','https://sen.neis.go.kr','https://evpn.sen.go.kr'],
 C10:['https://pen.eduptl.kr','https://pen.neis.go.kr','https://evpn.pen.go.kr'],
 D10:['https://dge.eduptl.kr','https://dge.neis.go.kr','https://evpn.dge.go.kr'],
 E10:['https://ice.eduptl.kr','https://ice.neis.go.kr','https://evpn.ice.go.kr'],
 F10:['https://gen.eduptl.kr','https://gen.neis.go.kr','https://evpn.gen.go.kr'],
 G10:['https://dje.eduptl.kr','https://dje.neis.go.kr','https://evpn.dje.go.kr'],
 H10:['https://use.eduptl.kr','https://use.neis.go.kr','https://evpn.use.go.kr'],
 I10:['https://sje.eduptl.kr','https://sje.neis.go.kr','https://evpn.sje.go.kr'],
 J10:['https://goe.eduptl.kr','https://goe.neis.go.kr','https://evpn.goe.go.kr'],
 K10:['https://kwe.eduptl.kr','https://kwe.neis.go.kr','https://evpn.kwe.go.kr'],
 M10:['https://cbe.eduptl.kr','https://cbe.neis.go.kr','https://evpn.cbe.go.kr'],
 N10:['https://cne.eduptl.kr','https://cne.neis.go.kr','https://evpn.cne.go.kr'],
 P10:['https://jbe.eduptl.kr','https://jbe.neis.go.kr','https://evpn.jbe.go.kr'],
 Q10:['https://jne.eduptl.kr','https://jne.neis.go.kr','https://evpn.jne.go.kr'],
 R10:['https://gbe.eduptl.kr','https://gbe.neis.go.kr','https://evpn.gbe.kr'],
 S10:['https://gne.eduptl.kr','https://gne.neis.go.kr','https://evpn.gne.go.kr'],
 T10:['https://jje.eduptl.kr','https://jje.neis.go.kr','https://evpn.jje.go.kr'],
};
// Reuse the existing office-code and school/eVPN lookup structure only.
// No user document is written or overwritten by registering these initial values.
export const OFFICE_LAUNCHER_URLS:Readonly<Record<OfficeCode,OfficeUrls>>=Object.freeze(Object.fromEntries((Object.keys(EDUCATION_OFFICES) as OfficeCode[]).map(code=>{
 const [portal,neis,evpn]=INITIAL_OFFICE_URLS[code];
 const urls=Object.freeze({portal:initial(portal,code,'portal'),neis:initial(neis,code,'neis'),evpn:initial(evpn,code,'evpn')});
 return [code,Object.freeze({school:urls,evpn:urls})];
})) as Record<OfficeCode,OfficeUrls>);
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
