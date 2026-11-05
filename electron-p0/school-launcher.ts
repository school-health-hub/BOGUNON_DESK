import {ADMIN_SYSTEMS,adminAddresses,adminEnvironment,safeAdminLaunchUrl,validateAdminDocument,type AdminDocument,type AdminEnvironment} from './admin-protocol.js';
import {OFFICE_LAUNCHER_URLS,schoolKeys,validateSchool,type SchoolInfo,type OfficeCode,type VerifiedSchoolUrl} from './school-protocol.js';

export const SCHOOL_SYSTEMS={...ADMIN_SYSTEMS,evpn:'eVPN'} as const;
export type SchoolSystem=keyof typeof SCHOOL_SYSTEMS;
export type SchoolAddressPreview=Readonly<{school:SchoolInfo|null;revision:number;environment:AdminEnvironment;readonly:boolean;entries:readonly Readonly<{system:SchoolSystem;currentUrl:string;proposed:VerifiedSchoolUrl|null}>[]}>;
export type ApplySchoolAddresses=Readonly<{officeCode:string;schoolCode:string;expectedRevision:number;environment:AdminEnvironment;systems:readonly SchoolSystem[]}>;
export const SCHOOL_SESSION_GUIDE='공식 사이트에서 직접 인증하세요. 같은 기본 브라우저 프로필의 유효한 공식 세션만 재사용될 수 있으며, 만료 시 해당 사이트에서 다시 로그인해야 합니다. DESK 계정·Electron 내장 브라우저와 쿠키·세션을 공유하지 않습니다. 비밀번호·인증서 암호·OTP를 저장하거나 세션을 연장하지 않습니다.';
export function schoolAddressPreview(school:SchoolInfo|null,document:AdminDocument,readonly=false):SchoolAddressPreview{
 if(school)validateSchool(school);const environment=adminEnvironment(document),addresses=adminAddresses(document,environment),urls=school?OFFICE_LAUNCHER_URLS[school.officeCode as OfficeCode]?.[environment]:undefined;
 return {school,revision:document.revision,environment,readonly,entries:(Object.keys(SCHOOL_SYSTEMS) as SchoolSystem[]).map(system=>({system,currentUrl:system==='evpn'?document.launcher?.entryUrl??'':addresses[system],proposed:urls?.[system]??null}))};
}
export function validateSchoolAddressApply(value:unknown):ApplySchoolAddresses{
 if(!schoolKeys(value,['officeCode','schoolCode','expectedRevision','environment','systems'])||typeof value.officeCode!=='string'||!Object.prototype.hasOwnProperty.call(OFFICE_LAUNCHER_URLS,value.officeCode)||typeof value.schoolCode!=='string'||!/^\d{7}$/.test(value.schoolCode)||!Number.isSafeInteger(value.expectedRevision)||Number(value.expectedRevision)<0||!['school','evpn'].includes(String(value.environment))||!Array.isArray(value.systems)||!value.systems.length||value.systems.length>4||new Set(value.systems).size!==value.systems.length||value.systems.some(key=>typeof key!=='string'||!Object.prototype.hasOwnProperty.call(SCHOOL_SYSTEMS,key)))throw Error('학교·교육청·적용 항목을 다시 확인해 주세요.');
 return value as ApplySchoolAddresses;
}
/** Only Main calls this with the current school/store snapshot, after explicit review. */
export function withSchoolAddresses(document:AdminDocument,preview:SchoolAddressPreview,systems:readonly SchoolSystem[]):AdminDocument{
 const addresses={...adminAddresses(document,preview.environment)};let entryUrl=document.launcher?.entryUrl;
 for(const system of systems){const proposal=preview.entries.find(row=>row.system===system)?.proposed;if(!proposal)throw Error('등록된 초기 주소가 없습니다. 기관 안내를 확인해 직접 등록해 주세요.');const url=safeAdminLaunchUrl(proposal.url);if(system==='evpn')entryUrl=url;else addresses[system]=url;}
 return validateAdminDocument({...document,...(preview.environment==='school'?{systems:addresses}:{}),launcher:{...document.launcher,environment:preview.environment,evpn:preview.environment==='evpn'?addresses:adminAddresses(document,'evpn'),...(entryUrl!==undefined?{entryUrl}:{})}});
}
