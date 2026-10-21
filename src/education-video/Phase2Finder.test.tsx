// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,act} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {EducationVideoFinder} from './EducationVideoFinder';
import {searchMockVideos} from './model';
import {toEntry} from './libraryV2';
import type {SearchDependencies} from './searchService';
beforeEach(()=>localStorage.clear());afterEach(()=>cleanup());
const fill=()=>{fireEvent.change(screen.getByLabelText('교육 주제'),{target:{value:'교육'}});fireEvent.change(screen.getByLabelText('검색 대상'),{target:{value:'학생'}});fireEvent.click(screen.getByRole('button',{name:'서버 검색 준비'}));};
const session=async()=>({accessToken:'fake-in-memory-only',userId:'qa-user',expiresAt:Date.now()+60000});
const row=()=>({videoId:'validVid001',title:'주입 영상',channelId:'UCexUyFaq9YH7XJfCQzVR_jg',channelTitle:'교육부',durationSeconds:null,url:'https://www.youtube.com/watch?v=validVid001',official:true,officialEvidence:'https://moe.go.kr/main.do',synthetic:false,fetchedAt:new Date().toISOString()});
describe('Phase2 authenticated UI',()=>{
 it('blocks signed-out search and leaves local Mock available',()=>{const transport=vi.fn();render(<EducationVideoFinder onClose={()=>{}} searchDependencies={{getSession:session,transport}}/>);fill();expect(screen.getByRole('button',{name:'서버 검색(외부 호출 차단)'}).hasAttribute('disabled')).toBe(true);expect(transport).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'로컬 Mock'}));expect(screen.getByRole('button',{name:'Mock 영상 검색'}).hasAttribute('disabled')).toBe(false);});
 it('does not apply in-flight response after logout',async()=>{
  let resolve:(value:unknown)=>void=()=>{};const transport=()=>new Promise<unknown>(done=>{resolve=done;});const dependencies:SearchDependencies={getSession:session,transport};
  const view=render(<EducationVideoFinder onClose={()=>{}} authStatus="signedIn" authIdentity="qa-user" searchDependencies={dependencies}/>);fill();fireEvent.click(screen.getByRole('button',{name:'서버 검색(외부 호출 차단)'}));await act(async()=>{});
  view.rerender(<EducationVideoFinder onClose={()=>{}} authStatus="signedOut" authIdentity="" searchDependencies={dependencies}/>);
  await act(async()=>resolve({source:'live',notice:'',results:[row()]}));expect(screen.queryByText('주입 영상')).toBeNull();
 });
 it('shows unknown duration only in all results and real provenance',async()=>{render(<EducationVideoFinder onClose={()=>{}} authStatus="signedIn" authIdentity="qa-user" searchDependencies={{getSession:session,transport:async()=>({source:'live',notice:'주입 응답',results:[row()]})}}/>);fill();fireEvent.click(screen.getByRole('button',{name:'서버 검색(외부 호출 차단)'}));await waitFor(()=>expect(screen.getByText('주입 응답').textContent).toBe('주입 응답'));fireEvent.click(screen.getByRole('button',{name:'전체 보기'}));expect(screen.getByText('영상 메타데이터 · 길이 미확인')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'주입 영상 선택'}));expect(screen.getByText('선택한 영상')).toBeTruthy();});
 it('loads expired teacher data without inventing provider fields',async()=>{const video=searchMockVideos({topic:'교육',target:'학생',minutes:10})[0];const entry=toEntry({...video,educationTitle:'보존 교육명',target:'학생',schedule:'이번주',instructions:'확인',message:'교사 수정문',notes:'보호 메모'},Date.now()-31*86400000);localStorage.setItem('bogunon.education-video.browser-qa.v2',JSON.stringify({version:2,entries:[entry]}));render(<EducationVideoFinder onClose={()=>{}}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'불러오기'})).toBeTruthy());fireEvent.click(screen.getByRole('button',{name:'불러오기'}));expect(screen.getByRole('button',{name:'안내문 생성'}).hasAttribute('disabled')).toBe(true);expect(screen.getByRole('status').textContent).toContain('메타데이터');expect(screen.getByDisplayValue('보호 메모')).toBeTruthy();});
});
it('expires provider while screen stays open without losing teacher message',async()=>{
 vi.useFakeTimers();const now=Date.now();vi.setSystemTime(now);
 const mock=searchMockVideos({topic:'교육',target:'학생',minutes:10})[0];const entry=toEntry({...mock,educationTitle:'교육',target:'학생',schedule:'이번주',instructions:'확인',message:'보존된 교사 문구',notes:'보존 메모'},now);
 const expiring={...entry,provider:{...entry.provider,expiresAt:new Date(now+1000).toISOString()}};
 localStorage.setItem('bogunon.education-video.browser-qa.v2',JSON.stringify({version:2,entries:[expiring]}));
 await act(async()=>{render(<EducationVideoFinder onClose={()=>{}}/>);});fireEvent.click(screen.getByRole('button',{name:'불러오기'}));
 expect(screen.getByRole('button',{name:'안내문 생성'}).hasAttribute('disabled')).toBe(false);
 await act(async()=>{vi.advanceTimersByTime(1001);});
 expect(screen.getByRole('button',{name:'안내문 생성'}).hasAttribute('disabled')).toBe(true);
 expect(screen.getByDisplayValue('보존된 교사 문구')).toBeTruthy();vi.useRealTimers();
});
it('does not dispatch if logout happens while reading session',async()=>{
 let resolve:(value:{accessToken:string;userId:string;expiresAt:number}|null)=>void=()=>{};
 const getSession=()=>new Promise<{accessToken:string;userId:string;expiresAt:number}|null>(done=>{resolve=done;});const transport=vi.fn();const dependencies={getSession,transport};
 const view=render(<EducationVideoFinder onClose={()=>{}} authStatus="signedIn" authIdentity="qa-user" searchDependencies={dependencies}/>);fill();fireEvent.click(screen.getByRole('button',{name:'서버 검색(외부 호출 차단)'}));
 view.rerender(<EducationVideoFinder onClose={()=>{}} authStatus="signedOut" authIdentity="" searchDependencies={dependencies}/>);
 await act(async()=>resolve(await session()));expect(transport).not.toHaveBeenCalled();
});
