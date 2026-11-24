// @vitest-environment jsdom
import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {SmartWorkLauncher} from '../renderer/school-admin/SmartWorkLauncher';
import {SMART_WORK_ACTIONS,type WorkActionId} from '../smart-work-launcher';
import {emptySmartLauncherPreferences,type SmartLauncherPreferences} from '../smart-launcher-preferences';
import type {SmartLauncherBridge} from '../admin-protocol';

const ok=<T,>(data:T)=>({ok:true as const,data});
const loaded=(revision=0,favorites:readonly ('open-portal'|'open-neis')[]=[])=>({document:{...emptySmartLauncherPreferences(),revision,favorites},recovered:false});
const bridge=(initial:SmartLauncherPreferences=emptySmartLauncherPreferences()):SmartLauncherBridge=>{let document=initial;const update=(next:SmartLauncherPreferences)=>{document=next;return ok({document,recovered:false});};return {
 catalog:vi.fn(async()=>ok(SMART_WORK_ACTIONS)),load:vi.fn(async()=>ok({document,recovered:false})),
 toggleFavorite:vi.fn(async(id,revision)=>update({...document,revision:revision+1,favorites:document.favorites.includes(id)?document.favorites.filter(value=>value!==id):[...document.favorites,id]})),
 reorderFavorites:vi.fn(async(ids,revision)=>update({...document,revision:revision+1,favorites:ids})),
 setRecentEnabled:vi.fn(async(enabled,revision)=>update({...document,revision:revision+1,recentEnabled:enabled})),
 clearRecent:vi.fn(async revision=>update({...document,revision:revision+1,recent:[]})),launch:vi.fn(async()=>ok({status:'canceled' as const})),
};};

afterEach(cleanup);

it('shows three primary systems while keeping the twenty detailed actions collapsed',async()=>{
 const api=bridge();render(<SmartWorkLauncher api={api}/>);await screen.findByRole('heading',{name:'학교 업무 바로가기'});
 expect(screen.getByRole('button',{name:'업무포털 선택'})).toBeTruthy();expect(screen.getByRole('button',{name:'나이스 선택'})).toBeTruthy();expect(screen.getByRole('button',{name:'K-에듀파인 선택'})).toBeTruthy();
 expect(screen.queryByRole('button',{name:'연가 신청'})).toBeNull();expect(screen.getByRole('button',{name:'나이스 세부 업무 펼치기'}).getAttribute('aria-expanded')).toBe('false');
 fireEvent.click(screen.getByRole('button',{name:'나이스 세부 업무 펼치기'}));expect(screen.getByRole('button',{name:'연가 신청'})).toBeTruthy();
 expect(screen.getAllByText('UNVERIFIED · 실제 메뉴 경로로 검증되지 않음')).toHaveLength(1);
});

it('searches, filters, and keeps guide expansion separate from launch',async()=>{
 const api=bridge();render(<SmartWorkLauncher api={api}/>);await screen.findByRole('heading',{name:'학교 업무 바로가기'});
 expect(api.catalog).toHaveBeenCalledTimes(1);expect(api.load).toHaveBeenCalledTimes(1);
 fireEvent.change(screen.getByRole('searchbox',{name:'업무 검색'}),{target:{value:'없는 업무'}});expect(screen.getByText('검색 조건에 맞는 업무가 없습니다.')).toBeTruthy();
 fireEvent.change(screen.getByRole('searchbox',{name:'업무 검색'}),{target:{value:''}});fireEvent.change(screen.getByRole('combobox'),{target:{value:'document'}});expect(screen.queryByRole('button',{name:'연가 신청'})).toBeNull();
 fireEvent.change(screen.getByRole('combobox'),{target:{value:''}});
 fireEvent.change(screen.getByRole('searchbox',{name:'업무 검색'}),{target:{value:'품의'}});fireEvent.click(screen.getByRole('button',{name:'물품 구매 품의'}));
 fireEvent.click(screen.getByRole('button',{name:'메뉴 안내 펼치기'}));expect(screen.getByText('학교회계 › 사업관리 › 사업담당 › 품의/정산 › 품의등록')).toBeTruthy();expect(api.launch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'실행'}));await screen.findByText('실행을 취소했습니다. 최근 업무에는 기록하지 않았습니다.');expect(api.launch).toHaveBeenCalledWith('purchase-request');
});

it('orders favorites, prevents duplicate launch, and controls recent history from a collapsed settings panel',async()=>{
 const api=bridge({...emptySmartLauncherPreferences(),favorites:['open-portal','open-neis'],recentEnabled:true,recent:[{id:'open-portal',timestamp:'2026-11-24T00:00:00.000Z'}]});
 let finish:((value:Awaited<ReturnType<SmartLauncherBridge['launch']>>)=>void)|undefined;vi.mocked(api.launch).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 render(<SmartWorkLauncher api={api}/>);const moveUp=await screen.findByRole('button',{name:'나이스 열기 위로'});expect(moveUp instanceof HTMLButtonElement&&moveUp.disabled).toBe(false);fireEvent.click(moveUp);await waitFor(()=>expect(api.reorderFavorites).toHaveBeenCalledWith(['open-neis','open-portal'],0));
 fireEvent.click(screen.getByRole('button',{name:'나이스 열기',pressed:false}));const launch=screen.getByRole('button',{name:'실행'});fireEvent.click(launch);fireEvent.click(launch);expect(api.launch).toHaveBeenCalledTimes(1);finish?.(ok({status:'launched',recentRecorded:true}));await screen.findByText('시스템 열기를 요청했습니다. 최근 업무에 기록했습니다.');
 expect(screen.queryByRole('button',{name:'최근 업무 전체 지우기'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'최근 실행 설정 열기'}));
 fireEvent.click(screen.getByRole('button',{name:'최근 업무 전체 지우기'}));await waitFor(()=>expect(api.clearRecent).toHaveBeenCalledWith(1));
 fireEvent.click(screen.getByRole('button',{name:'최근 업무 기록 끄기'}));await waitFor(()=>expect(api.setRecentEnabled).toHaveBeenCalledWith(false,2));
});

it('adds and removes favorites, warns at twelve, and enables recent from default off',async()=>{
 const api=bridge();const view=render(<SmartWorkLauncher api={api}/>);await screen.findByRole('heading',{name:'학교 업무 바로가기'});fireEvent.click(screen.getByRole('button',{name:'나이스 세부 업무 펼치기'}));
 fireEvent.click(screen.getByRole('button',{name:'연가 신청 즐겨찾기 추가'}));await screen.findByRole('button',{name:'연가 신청 즐겨찾기 제거'});expect(api.toggleFavorite).toHaveBeenLastCalledWith('leave-annual',0);
 fireEvent.click(screen.getByRole('button',{name:'연가 신청 즐겨찾기 제거'}));await screen.findByRole('button',{name:'연가 신청 즐겨찾기 추가'});expect(api.toggleFavorite).toHaveBeenLastCalledWith('leave-annual',1);
 fireEvent.click(screen.getByRole('button',{name:'최근 실행 설정 열기'}));fireEvent.click(screen.getByRole('button',{name:'최근 업무 기록 켜기'}));await waitFor(()=>expect(api.setRecentEnabled).toHaveBeenCalledWith(true,2));
 view.unmount();const favorites=SMART_WORK_ACTIONS.slice(0,12).map(action=>action.id) satisfies readonly WorkActionId[];const capped=bridge({...emptySmartLauncherPreferences(),favorites});render(<SmartWorkLauncher api={capped}/>);await screen.findByText('즐겨찾기는 최대 12개까지 등록할 수 있습니다.');fireEvent.click(screen.getByRole('button',{name:'나이스 세부 업무 펼치기'}));const thirteenth=screen.getByRole('button',{name:'학생 건강기록 확인 즐겨찾기 추가'});expect(thirteenth instanceof HTMLButtonElement&&thirteenth.disabled).toBe(true);
});

it('reports malformed catalog and generic bridge failures without inventing state',async()=>{
 const malformed=bridge();vi.mocked(malformed.catalog).mockResolvedValueOnce(ok([{...SMART_WORK_ACTIONS[0],manualPath:['검증되지 않은 가짜 경로']}]));render(<SmartWorkLauncher api={malformed}/>);await screen.findByText('검증되지 않은 업무에는 수동 경로를 둘 수 없습니다.');expect(screen.queryByRole('button',{name:'연가 신청'})).toBeNull();
 cleanup();const failed=bridge();vi.mocked(failed.catalog).mockResolvedValueOnce({ok:false,error:{code:'STORAGE_ERROR',message:'카탈로그를 읽지 못했습니다.',retryable:true}});render(<SmartWorkLauncher api={failed}/>);await screen.findByText('카탈로그를 읽지 못했습니다.');expect(screen.queryByRole('button',{name:'연가 신청'})).toBeNull();
});

it('survives unavailable, recovered, conflict, and malformed bridge states',async()=>{
 const {rerender}=render(<SmartWorkLauncher/>);expect(screen.getByText('이 실행본에서는 스마트 업무 런처를 사용할 수 없습니다.')).toBeTruthy();
 const api=bridge();vi.mocked(api.load).mockResolvedValueOnce(ok({...loaded(),recovered:true}));rerender(<SmartWorkLauncher api={api}/>);await screen.findByText('복구된 설정을 읽기 전용으로 표시합니다. 원본을 확인해 주세요.');fireEvent.click(screen.getByRole('button',{name:'나이스 세부 업무 펼치기'}));const lockedFavorite=screen.getByRole('button',{name:'연가 신청 즐겨찾기 추가'});expect(lockedFavorite instanceof HTMLButtonElement&&lockedFavorite.disabled).toBe(true);expect(screen.getByText('읽기 전용 · 복구 또는 충돌 상태의 설정은 변경하지 않습니다.')).toBeTruthy();
 cleanup();const conflict=bridge();vi.mocked(conflict.toggleFavorite).mockResolvedValueOnce({ok:false,error:{code:'CONFLICT',message:'설정 충돌',retryable:true}});render(<SmartWorkLauncher api={conflict}/>);await screen.findByRole('heading',{name:'학교 업무 바로가기'});fireEvent.click(screen.getByRole('button',{name:'나이스 세부 업무 펼치기'}));fireEvent.click(screen.getByRole('button',{name:'연가 신청 즐겨찾기 추가'}));await screen.findByText(/설정 충돌/);expect(screen.getByText('읽기 전용 · 복구 또는 충돌 상태의 설정은 변경하지 않습니다.')).toBeTruthy();
});
