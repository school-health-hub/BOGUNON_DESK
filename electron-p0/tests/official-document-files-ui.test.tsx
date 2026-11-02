// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {OfficialDocumentWorkspace} from '../../src/official-document/OfficialDocumentWorkspace';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});
it('keeps edited source after a delayed import and preserves text on cancellation or error',async()=>{
 let finish!:(r:unknown)=>void;const pick=vi.fn(()=>new Promise(r=>{finish=r;}));vi.stubGlobal('electronWork',{officialDocument:{pick,cancel:vi.fn(async()=>({ok:true,data:null})),save:vi.fn()}});vi.spyOn(window,'confirm').mockReturnValue(true);
 render(<OfficialDocumentWorkspace onClose={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'공문 핵심정리'}));const textarea=screen.getByLabelText('받은 공문 원문') as HTMLTextAreaElement;fireEvent.change(textarea,{target:{value:'합성 원문'}});fireEvent.click(screen.getByRole('button',{name:'PDF/HWPX/ODT 가져오기'}));fireEvent.change(textarea,{target:{value:'합성 편집 유지'}});finish({ok:true,data:{text:'오래된 결과',format:'odt',sourceName:'synthetic.odt'}});await vi.waitFor(()=>expect((screen.getByRole('button',{name:'PDF/HWPX/ODT 가져오기'}) as HTMLButtonElement).disabled).toBe(false));expect(textarea.value).toBe('합성 편집 유지');
 fireEvent.click(screen.getByRole('button',{name:'PDF/HWPX/ODT 가져오기'}));finish({ok:true,data:null});await vi.waitFor(()=>expect((screen.getByRole('button',{name:'PDF/HWPX/ODT 가져오기'}) as HTMLButtonElement).disabled).toBe(false));expect(textarea.value).toBe('합성 편집 유지');
});
it('sends the reviewed draft only to the typed ODT API and retains preview after failure',async()=>{
 const save=vi.fn(async(_request:unknown)=>({ok:false,error:{message:'합성 저장 실패'}}));vi.stubGlobal('electronWork',{officialDocument:{pick:vi.fn(),cancel:async()=>({ok:true,data:null}),save}});render(<OfficialDocumentWorkspace onClose={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'기본 초안 만들기'}));fireEvent.click(screen.getByRole('button',{name:'ODT 새 파일 저장'}));await screen.findByText('합성 저장 실패');expect(save).toHaveBeenCalledOnce();expect(Object.keys(save.mock.calls[0][0] as object).sort()).toEqual(['attachments','body','hasTableText','title']);expect(screen.getByRole('button',{name:'본문 복사'})).toBeTruthy();
});
