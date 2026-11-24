import {describe,expect,it} from 'vitest';
import {
 SMART_WORK_ACTIONS,
 filterWorkActions,
 findWorkAction,
 searchWorkActions,
 validateWorkActionCatalog,
 validateWorkActionCategory,
 validateWorkActionId,
} from '../smart-work-launcher.js';

const EXPECTED_ACTIONS=[
 ['leave-annual','leave','연가 신청','neis'],
 ['business-trip','leave','출장 신청','neis'],
 ['overtime','leave','시간외근무 신청','neis'],
 ['document-draft','document','기안','edufine'],
 ['document-approve','document','결재','edufine'],
 ['document-circulate','document','공람','edufine'],
 ['document-send','document','발송','edufine'],
 ['document-receive','document','접수','edufine'],
 ['document-box','document','문서함','edufine'],
 ['purchase-request','purchase-budget','물품 구매 품의','edufine'],
 ['budget-status','purchase-budget','예산 현황 확인','edufine'],
 ['expense-resolution','purchase-budget','지출결의 확인','edufine'],
 ['student-health-record','student-health','학생 건강기록 확인','neis'],
 ['health-check-results','student-health','건강검사 결과 확인','neis'],
 ['training-history','training-education','연수 이수 내역 확인','portal'],
 ['staff-training-guide','training-education','교직원 연수 안내 확인','portal'],
 ['open-portal','common-system','업무포털 열기','portal'],
 ['open-neis','common-system','나이스 열기','neis'],
 ['open-edufine','common-system','K-에듀파인 열기','edufine'],
 ['open-evpn','common-system','eVPN 접속','evpn'],
] as const;

describe('smart work launcher catalog',()=>{
 it('exposes the exact 20-action routing contract',()=>{
  // Given: the independently specified launcher contract
  // When: the catalog is projected to its routing fields
  const actual=SMART_WORK_ACTIONS.map(({id,category,label,system})=>[id,category,label,system]);
  // Then: every literal ID and route matches the approved list
  expect(actual).toEqual(EXPECTED_ACTIONS);
  expect(Object.isFrozen(SMART_WORK_ACTIONS)).toBe(true);
  expect(SMART_WORK_ACTIONS.every(Object.isFrozen)).toBe(true);
  expect(SMART_WORK_ACTIONS.some(action=>'url' in action)).toBe(false);
 });

 it('keeps the only field-verified route exact and all other routes unverified',()=>{
  // Given: the exact approved manual route
  const expectedPath=['학교회계','사업관리','사업담당','품의/정산','품의등록'];
  // When: the purchase action and remaining actions are inspected
  const purchase=findWorkAction('purchase-request');
  const remaining=SMART_WORK_ACTIONS.filter(action=>action.id!=='purchase-request');
  // Then: only that action carries verified navigation evidence
  expect(purchase).toEqual(expect.objectContaining({verification:'FIELD_VERIFIED',manualPath:expectedPath}));
  expect(Object.isFrozen(purchase?.manualPath)).toBe(true);
  expect(remaining.every(action=>action.verification==='UNVERIFIED'&&!('manualPath' in action))).toBe(true);
  expect(SMART_WORK_ACTIONS.filter(action=>action.category==='document').every(action=>!('manualPath' in action))).toBe(true);
 });
});

describe('smart work launcher pure queries',()=>{
 it('normalizes whitespace and case during search',()=>{
  // Given: whitespace/case noise
  // When: the catalog is queried
  const result=searchWorkActions('  OPEN   ');
  // Then: matching actions are returned in catalog order
  expect(result.map(action=>action.id)).toEqual(['open-portal','open-neis','open-edufine','open-evpn']);
 });

 it('finds the literal purchase request term',()=>{
  // Given: the Korean purchase-request term
  // When: the catalog is searched
  const result=searchWorkActions('품의');
  // Then: the exact action is returned
  expect(result.map(action=>action.id)).toEqual(['purchase-request']);
 });

 it('intersects search with category',()=>{
  // Given: a term present outside the selected category
  // When/Then: category selection constrains the search
  expect(searchWorkActions('품의','purchase-budget').map(action=>action.id)).toEqual(['purchase-request']);
  expect(searchWorkActions('품의','document')).toEqual([]);
 });

 it('filters by category without search coupling',()=>{
  // Given: the document category
  // When/Then: the literal document IDs are returned
  expect(filterWorkActions('document').map(action=>action.id)).toEqual(EXPECTED_ACTIONS.slice(3,9).map(([id])=>id));
 });

 it('rejects unknown identifiers and categories without stale fallbacks',()=>{
  // Given: malformed external literals
  // When/Then: validators reject instead of coercing stale state
  expect(()=>validateWorkActionId('missing-action')).toThrow('알 수 없는 업무 ID입니다.');
  expect(()=>validateWorkActionCategory('finance')).toThrow('알 수 없는 업무 분류입니다.');
  expect(findWorkAction('missing-action')).toBeUndefined();
 });
});

describe('smart work launcher catalog construction boundary',()=>{
 it('rejects duplicate IDs',()=>{
  // Given: a catalog with the first approved action duplicated
  const malformed:readonly unknown[]=[...SMART_WORK_ACTIONS,SMART_WORK_ACTIONS[0]];
  // When/Then: construction validation rejects stale duplicate state
  expect(()=>validateWorkActionCatalog(malformed)).toThrow('중복 업무 ID입니다.');
 });

 it('rejects manual paths on unverified actions',()=>{
  // Given: an unverified action carrying an unsupported manual route
  const malformed:readonly unknown[]=[{
   id:'leave-annual',category:'leave',label:'연가 신청',system:'neis',verification:'UNVERIFIED',manualPath:['임의 경로'],
  }];
  // When/Then: construction validation rejects misleading route evidence
  expect(()=>validateWorkActionCatalog(malformed)).toThrow('검증되지 않은 업무에는 수동 경로를 둘 수 없습니다.');
 });
});
