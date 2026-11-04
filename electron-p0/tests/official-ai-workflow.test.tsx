// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {OfficialDocumentWorkspace} from '../../src/official-document/OfficialDocumentWorkspace';
import {OfficialAiWorkflow} from '../renderer/official-document/OfficialAiWorkflow';
import {WidgetSessionProvider} from '../../src/dashboard/WidgetSessionContext';
import {LocalWorkspaceProvider} from '../renderer/local-tasks/LocalWorkspaceProvider';
import {buildRevisionPrompt,buildSummaryPrompt,buildCreatePrompt} from '../../src/official-document/promptBuilder';
import {createEmptyOfficialDocumentInput} from '../../src/official-document/documentGenerator';
const ok=<T,>(data:T)=>({ok:true as const,data});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
function setup(){
 const chatgpt={status:vi.fn(async()=>ok({supported:true,phase:'ready',planUsageEnabled:true,busy:false,model:'synthetic-model',models:[{id:'synthetic-model'}]})),generate:vi.fn(async()=>ok({text:'합성 AI 제안 본문. 끝.'})),cancel:vi.fn(async()=>ok(null))};
 const ai={status:vi.fn(async()=>ok({connected:true,busy:false,provider:'openai',model:'synthetic-api',models:[{id:'synthetic-api'}]})),generate:vi.fn(async()=>ok({text:'합성 API 제안'})),cancel:vi.fn(async()=>ok(null))};
 const files={pick:vi.fn(async()=>ok({text:'가져온 합성 원문. 끝.',sourceName:'synthetic.odt',format:'odt'})),save:vi.fn(),cancel:vi.fn(async()=>ok(null))};
 vi.stubGlobal('electronWork',{chatgpt,ai,officialDocument:files,tasks:{load:async()=>ok({document:{version:1,revision:0,tasks:[]},recovered:false}),save:vi.fn()}});
 vi.spyOn(window,'confirm').mockReturnValue(true);const copy=vi.fn(async(_text:string)=>{});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:copy}});
 const close=vi.fn();const view=render(<WidgetSessionProvider><LocalWorkspaceProvider><OfficialDocumentWorkspace onClose={close} renderAiWorkflow={context=><OfficialAiWorkflow key={context.sessionId} context={context} onSettings={vi.fn()}/>}/></LocalWorkspaceProvider></WidgetSessionProvider>);
 return {chatgpt,ai,files,copy,close,view};
}
function draft(){fireEvent.click(screen.getByRole('button',{name:'빈 문서 작성'}));fireEvent.change(screen.getByLabelText('제목',{exact:true}),{target:{value:'현재 합성 원고'}});fireEvent.change(screen.getByLabelText('본문',{exact:true}),{target:{value:'교사 편집 본문. 끝.'}});}
async function review(){await waitFor(()=>expect((screen.getByRole('button',{name:'전송 전 내용 검토'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(screen.getByRole('button',{name:'전송 전 내용 검토'}));return screen.getByRole('dialog',{name:'공문 AI 전송 확인'});}
async function send(){const dialog=await review();fireEvent.click(within(dialog).getByRole('button',{name:'확인 후 전송'}));}
it('reuses the revision prompt, keeps original/draft/proposal separate, and sends nothing before review approval',async()=>{
 const c=setup();fireEvent.click(screen.getByRole('button',{name:'PDF/HWPX/ODT 가져오기'}));await screen.findByDisplayValue('가져온 합성 원문. 끝.');fireEvent.click(screen.getByRole('button',{name:'신규 공문 작성'}));draft();fireEvent.change(screen.getByLabelText('수정 요청 사항'),{target:{value:'합성 표현 다듬기'}});
 const dialog=await review(),outbound=within(dialog).getByLabelText('AI 서비스로 전송될 내용') as HTMLTextAreaElement;
 expect(outbound.value).toBe(buildRevisionPrompt({original:'현재 합성 원고\n\n교사 편집 본문. 끝.',request:'합성 표현 다듬기'}));expect(c.chatgpt.generate).not.toHaveBeenCalled();expect(c.ai.generate).not.toHaveBeenCalled();
 fireEvent.change(outbound,{target:{value:'이름: 합성명 연락처: 010-0000-0000'}});expect((within(dialog).getByRole('button',{name:'확인 후 전송'}) as HTMLButtonElement).disabled).toBe(true);expect(c.chatgpt.generate).not.toHaveBeenCalled();
 fireEvent.change(outbound,{target:{value:'교사가 검토한 합성 수정 요청'}});fireEvent.click(within(dialog).getByRole('button',{name:'확인 후 전송'}));await screen.findByDisplayValue('합성 AI 제안 본문. 끝.');expect(c.chatgpt.generate).toHaveBeenCalledExactlyOnceWith({tool:'official-document',prompt:'교사가 검토한 합성 수정 요청'});expect((screen.getByLabelText('본문') as HTMLTextAreaElement).value).toBe('교사 편집 본문. 끝.');
 fireEvent.click(screen.getByRole('button',{name:'검토한 제목·본문 적용'}));expect((screen.getByLabelText('본문') as HTMLTextAreaElement).value).toBe('합성 AI 제안 본문. 끝.');fireEvent.click(screen.getByRole('button',{name:'공문 핵심정리'}));expect((screen.getByLabelText('받은 공문 원문') as HTMLTextAreaElement).value).toBe('가져온 합성 원문. 끝.');expect(c.files.save).not.toHaveBeenCalled();
});
it('requires selection/confirmation for partial append and preserves the manuscript on rejected application',async()=>{
 setup();draft();fireEvent.change(screen.getByLabelText('수정 요청 사항'),{target:{value:'다듬기'}});await send();const output=await screen.findByLabelText('검토·수정할 제안') as HTMLTextAreaElement;
 fireEvent.click(screen.getByRole('button',{name:'선택 부분을 본문 끝에 추가'}));expect(screen.getByText('AI 제안에서 적용할 문구를 먼저 선택해 주세요.')).toBeTruthy();
 vi.mocked(window.confirm).mockReturnValueOnce(false);fireEvent.click(screen.getByRole('button',{name:'검토한 제목·본문 적용'}));expect((screen.getByLabelText('본문') as HTMLTextAreaElement).value).toBe('교사 편집 본문. 끝.');
 output.setSelectionRange(0,5);fireEvent.click(screen.getByRole('button',{name:'선택 부분을 본문 끝에 추가'}));expect((screen.getByLabelText('본문') as HTMLTextAreaElement).value).toBe('교사 편집 본문. 끝.\n합성 AI');
});
it('invalidates a late response after a new edit and cancels only its owned ChatGPT request',async()=>{
 const c=setup();let finish!:(v:any)=>void;c.chatgpt.generate.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));draft();fireEvent.change(screen.getByLabelText('수정 요청 사항'),{target:{value:'다듬기'}});await send();fireEvent.change(screen.getByLabelText('본문'),{target:{value:'더 최근의 합성 원고. 끝.'}});finish(ok({text:'오래된 제안'}));await waitFor(()=>expect(c.chatgpt.cancel).toHaveBeenCalledOnce());expect(c.ai.cancel).not.toHaveBeenCalled();expect(screen.queryByDisplayValue('오래된 제안')).toBeNull();expect((screen.getByLabelText('본문') as HTMLTextAreaElement).value).toBe('더 최근의 합성 원고. 끝.');
});
it('preserves prior proposal on cancelled, failed, or incomplete responses; keeps the API route',async()=>{
 const c=setup();draft();fireEvent.change(screen.getByLabelText('수정 요청 사항'),{target:{value:'다듬기'}});await send();await screen.findByDisplayValue('합성 AI 제안 본문. 끝.');
 c.chatgpt.generate.mockResolvedValueOnce(ok(null) as any);await send();await screen.findByText('전송을 취소했습니다. 원고와 이전 AI 결과는 유지했습니다.');expect(screen.getByDisplayValue('합성 AI 제안 본문. 끝.')).toBeTruthy();
 c.chatgpt.generate.mockRejectedValueOnce(Error('synthetic timeout'));await send();await screen.findByText(/AI 요청을 완료하지 못했습니다/);expect(screen.getByDisplayValue('합성 AI 제안 본문. 끝.')).toBeTruthy();
 c.chatgpt.generate.mockResolvedValueOnce(ok({text:''}));await send();await waitFor(()=>expect((screen.getByRole('button',{name:'전송 전 내용 검토'}) as HTMLButtonElement).disabled).toBe(false));expect(screen.getByDisplayValue('합성 AI 제안 본문. 끝.')).toBeTruthy();
 fireEvent.change(screen.getByLabelText('공문 AI 연결'),{target:{value:'api'}});await send();await screen.findByDisplayValue('합성 API 제안');expect(c.ai.generate).toHaveBeenCalledOnce();expect(c.chatgpt.generate).toHaveBeenCalledTimes(4);
});
it('builds original summary/create prompts, supports edited summary/copy/retry and never changes the draft automatically',async()=>{
 const c=setup();draft();fireEvent.change(screen.getByRole('combobox',{name:'공문 AI 작업'}),{target:{value:'summary'}});const dialog=await review();expect((within(dialog).getByRole('textbox') as HTMLTextAreaElement).value).toBe(buildSummaryPrompt('현재 합성 원고\n\n교사 편집 본문. 끝.'));fireEvent.click(within(dialog).getByRole('button',{name:'취소'}));expect(c.chatgpt.generate).not.toHaveBeenCalled();
 await send();await screen.findByText('요약 결과 · 교사 검토용');fireEvent.change(screen.getByLabelText('검토·수정할 제안'),{target:{value:'교사가 수정한 합성 요약'}});fireEvent.click(screen.getByRole('button',{name:'제안 복사'}));await waitFor(()=>expect(c.copy).toHaveBeenCalledWith('교사가 수정한 합성 요약'));await send();expect(c.chatgpt.generate).toHaveBeenCalledTimes(2);expect((screen.getByLabelText('본문') as HTMLTextAreaElement).value).toBe('교사 편집 본문. 끝.');
 await waitFor(()=>expect(screen.queryByRole('button',{name:'공문 AI 요청 취소'})).toBeNull());fireEvent.change(screen.getByRole('combobox',{name:'공문 AI 작업'}),{target:{value:'create'}});const create=await review();expect((within(create).getByRole('textbox') as HTMLTextAreaElement).value).toBe(buildCreatePrompt(createEmptyOfficialDocumentInput()));
});
it('cancels owned requests on explicit cancel/unmount and ignores late results',async()=>{
 const c=setup();let finish!:(v:any)=>void;c.chatgpt.generate.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));draft();fireEvent.change(screen.getByLabelText('수정 요청 사항'),{target:{value:'다듬기'}});await send();fireEvent.click(screen.getByRole('button',{name:'공문 AI 요청 취소'}));finish(ok({text:'취소 후 오래된 결과'}));await waitFor(()=>expect(c.chatgpt.cancel).toHaveBeenCalledOnce());expect(screen.queryByDisplayValue('취소 후 오래된 결과')).toBeNull();
 c.chatgpt.generate.mockImplementationOnce(()=>new Promise(()=>{}));await send();c.view.unmount();expect(c.chatgpt.cancel).toHaveBeenCalledTimes(2);expect(c.ai.cancel).not.toHaveBeenCalled();
});
it('marks existing results stale when document changes and protects close/new-work with a discard confirmation',async()=>{
 const c=setup();draft();fireEvent.change(screen.getByLabelText('수정 요청 사항'),{target:{value:'다듬기'}});await send();await screen.findByLabelText('검토·수정할 제안');fireEvent.change(screen.getByLabelText('본문'),{target:{value:'새로운 원고. 끝.'}});expect((screen.getByRole('button',{name:'검토한 제목·본문 적용'}) as HTMLButtonElement).disabled).toBe(true);
 vi.mocked(window.confirm).mockReturnValueOnce(false);fireEvent.click(screen.getByRole('button',{name:'보건 업무로'}));expect(c.close).not.toHaveBeenCalled();vi.mocked(window.confirm).mockReturnValueOnce(false);fireEvent.click(screen.getByRole('button',{name:'새 작업'}));expect(screen.getByLabelText('검토·수정할 제안')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'새 작업'}));expect(screen.queryByLabelText('검토·수정할 제안')).toBeNull();expect((screen.getByLabelText('수정 요청 사항') as HTMLTextAreaElement).value).toBe('');
});
it('does not send with unknown permission/model and clears a cancelled review without any request',async()=>{
 const c=setup();c.chatgpt.status.mockResolvedValue(ok({supported:true,phase:'permission-required',planUsageEnabled:false,busy:false,model:'synthetic-model',models:[]}) as any);draft();fireEvent.change(screen.getByLabelText('수정 요청 사항'),{target:{value:'다듬기'}});fireEvent.click(screen.getByRole('button',{name:'연결 상태 확인'}));await waitFor(()=>expect((screen.getByRole('button',{name:'전송 전 내용 검토'}) as HTMLButtonElement).disabled).toBe(true));expect(c.chatgpt.generate).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('공문 AI 연결'),{target:{value:'api'}});const dialog=await review();fireEvent.keyDown(dialog,{key:'Escape'});expect(screen.queryByRole('dialog')).toBeNull();expect(c.ai.generate).not.toHaveBeenCalled();
});
