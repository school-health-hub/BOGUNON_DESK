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

it('connects import to explicit editing/preview and distinguishes cancelled, failed, saved and subsequently edited drafts',async()=>{
 const original='합성 가져온 본문\n붙임\n1. 합성 자료 1부.\n끝.';
 const pick=vi.fn(async()=>({ok:true,data:{sourceName:'합성 원고.odt',format:'odt',text:original}}));
 const save=vi.fn().mockResolvedValueOnce({ok:true,data:null}).mockResolvedValueOnce({ok:false,error:{message:'합성 파일 저장 오류'}}).mockResolvedValueOnce({ok:true,data:{fileName:'새 원고.odt'}});
 vi.stubGlobal('electronWork',{officialDocument:{pick,save,cancel:async()=>({ok:true,data:null})}});
 render(<OfficialDocumentWorkspace onClose={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'PDF/HWPX/ODT 가져오기'}));await vi.waitFor(()=>expect((screen.getByLabelText('받은 공문 원문') as HTMLTextAreaElement).value).toBe(original));expect(screen.queryByLabelText('제목')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'가져온 원문으로 편집'}));expect((screen.getByLabelText('본문') as HTMLTextAreaElement).value).toBe(original);expect((screen.getByLabelText('본문 연동 붙임') as HTMLTextAreaElement).readOnly).toBe(true);
 fireEvent.change(screen.getByLabelText('제목',{exact:true}),{target:{value:'합성 편집 제목'}});fireEvent.click(screen.getByText('저장 내용 미리보기'));expect(screen.getByLabelText('ODT 저장 내용 미리보기').textContent).toBe('합성 편집 제목\n\n'+original);
 fireEvent.click(screen.getByRole('button',{name:'ODT 새 파일 저장'}));await screen.findByText('저장을 취소했습니다. 원고는 유지했습니다.');expect((screen.getByLabelText('본문') as HTMLTextAreaElement).value).toBe(original);
 fireEvent.click(screen.getByRole('button',{name:'ODT 새 파일 저장'}));await screen.findByText('합성 파일 저장 오류');expect(screen.getByText('임시 원고 · 아직 파일로 저장하지 않았습니다.')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'ODT 새 파일 저장'}));await screen.findByText('파일 저장 완료 · 새 원고.odt');expect(save.mock.calls[2][0]).toEqual({title:'합성 편집 제목',body:original,attachments:'붙임\n1. 합성 자료 1부.\n끝.',hasTableText:false});
 fireEvent.change(screen.getByLabelText('본문'),{target:{value:'다시 편집한 합성 본문\n끝.'}});expect(screen.getByText('저장 후 수정됨 · 현재 원고는 아직 저장하지 않았습니다.')).toBeTruthy();expect((screen.getByLabelText('본문 연동 붙임') as HTMLTextAreaElement).value).toBe('');
});

it('requires confirmation before destructive new/replace/close actions and preserves the draft when declined',async()=>{
 const onClose=vi.fn(),confirm=vi.spyOn(window,'confirm').mockReturnValue(false);vi.stubGlobal('electronWork',{officialDocument:{pick:vi.fn(),save:vi.fn(),cancel:async()=>({ok:true,data:null})}});
 render(<OfficialDocumentWorkspace onClose={onClose}/>);fireEvent.click(screen.getByRole('button',{name:'빈 문서 작성'}));fireEvent.change(screen.getByLabelText('제목',{exact:true}),{target:{value:'보호할 합성 제목'}});fireEvent.change(screen.getByLabelText('본문'),{target:{value:'보호할 합성 본문\n끝.'}});
 fireEvent.click(screen.getByRole('button',{name:'새 작업'}));fireEvent.click(screen.getByRole('button',{name:'기본 초안 만들기'}));fireEvent.click(screen.getByRole('button',{name:'보건 업무로'}));expect(onClose).not.toHaveBeenCalled();expect((screen.getByLabelText('제목',{exact:true}) as HTMLInputElement).value).toBe('보호할 합성 제목');expect(confirm).toHaveBeenCalledTimes(3);
 confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'새 작업'}));expect(screen.queryByLabelText('본문')).toBeNull();
});

it('keeps invalid import text editable and shows the existing privacy warning without attempting unsupported ODT output',async()=>{
 const text='학생명: 홍길동\n탭\t포함 원문';const save=vi.fn();vi.stubGlobal('electronWork',{officialDocument:{pick:async()=>({ok:true,data:{text,sourceName:'합성.pdf',format:'pdf'}}),save,cancel:async()=>({ok:true,data:null})}});
 render(<OfficialDocumentWorkspace onClose={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'PDF/HWPX/ODT 가져오기'}));await vi.waitFor(()=>expect((screen.getByLabelText('받은 공문 원문') as HTMLTextAreaElement).value).toBe(text));expect(screen.getByRole('alert').textContent).toContain('학생 이름');fireEvent.click(screen.getByRole('button',{name:'가져온 원문으로 편집'}));expect((screen.getByLabelText('본문') as HTMLTextAreaElement).value).toBe(text);expect((screen.getByRole('button',{name:'ODT 새 파일 저장'}) as HTMLButtonElement).disabled).toBe(true);expect(save).not.toHaveBeenCalled();
});

it('does not report a cancelled import as a replacement, and keeps the draft editable after a failed import',async()=>{
 const pick=vi.fn().mockResolvedValueOnce({ok:true,data:null}).mockRejectedValueOnce(new Error('synthetic import failure'));
 vi.stubGlobal('electronWork',{officialDocument:{pick,save:vi.fn(),cancel:async()=>({ok:true,data:null})}});render(<OfficialDocumentWorkspace onClose={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'빈 문서 작성'}));fireEvent.change(screen.getByLabelText('제목',{exact:true}),{target:{value:'보존할 원고'}});fireEvent.change(screen.getByLabelText('본문'),{target:{value:'보존할 본문\n끝.'}});
 fireEvent.click(screen.getByRole('button',{name:'PDF/HWPX/ODT 가져오기'}));await screen.findByText('가져오기를 취소했습니다. 기존 원문과 원고는 유지했습니다.');fireEvent.click(screen.getByRole('button',{name:'PDF/HWPX/ODT 가져오기'}));await screen.findByText('가져오지 못했습니다. 기존 원문은 유지했습니다.');expect((screen.getByLabelText('본문') as HTMLTextAreaElement).value).toBe('보존할 본문\n끝.');expect((screen.getByLabelText('본문') as HTMLTextAreaElement).disabled).toBe(false);
});

it('records an already completed save even if a cancellation request crossed its reply',async()=>{
 let finish!:(r:unknown)=>void;const cancel=vi.fn(async()=>({ok:true,data:null}));vi.stubGlobal('electronWork',{officialDocument:{pick:vi.fn(),save:()=>new Promise(r=>{finish=r}),cancel}});render(<OfficialDocumentWorkspace onClose={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'기본 초안 만들기'}));fireEvent.click(screen.getByRole('button',{name:'ODT 새 파일 저장'}));expect((screen.getByLabelText('본문') as HTMLTextAreaElement).disabled).toBe(true);fireEvent.click(screen.getByRole('button',{name:'파일 처리 취소'}));finish({ok:true,data:{fileName:'completed.odt'}});await screen.findByText('파일 저장 완료 · completed.odt');expect((screen.getByLabelText('본문') as HTMLTextAreaElement).disabled).toBe(false);expect(cancel).toHaveBeenCalled();
});

it('uses its existing discard confirmation for an App Shell navigation request',()=>{
 const onClose=vi.fn(),confirm=vi.spyOn(window,'confirm').mockReturnValue(false);vi.stubGlobal('electronWork',{officialDocument:{pick:vi.fn(),save:vi.fn(),cancel:async()=>({ok:true,data:null})}});
 const view=render(<OfficialDocumentWorkspace embedded closeRequest={0} onClose={onClose}/>);fireEvent.click(screen.getByRole('button',{name:'빈 문서 작성'}));fireEvent.change(screen.getByLabelText('제목',{exact:true}),{target:{value:'보호할 통합 원고'}});
 view.rerender(<OfficialDocumentWorkspace embedded closeRequest={1} onClose={onClose}/>);
 expect(confirm).toHaveBeenCalledOnce();expect(onClose).not.toHaveBeenCalled();expect((screen.getByLabelText('제목',{exact:true}) as HTMLInputElement).value).toBe('보호할 통합 원고');expect(screen.queryByRole('heading',{name:'공문작업실'})).toBeNull();
 confirm.mockReturnValue(true);view.rerender(<OfficialDocumentWorkspace embedded closeRequest={2} onClose={onClose}/>);expect(onClose).toHaveBeenCalledOnce();
});
