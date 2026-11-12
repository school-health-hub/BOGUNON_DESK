// @vitest-environment jsdom
import {vi,it,expect,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {NewsletterStudio} from './NewsletterStudio';
import {createNewsletterProject} from './project';
import {createNewsletterDesignState} from './rendering/designSchema';
import {serializeStudioDocument,type StudioDocument} from './studioDocument';
vi.mock('./rendering/NewsletterDesignEditor',()=>({NewsletterDesignEditor:({project,initialDesign,onChange}:{project:StudioDocument['project'];initialDesign:StudioDocument['design'];onChange:(d:StudioDocument)=>void})=><section><h2>{project.title}</h2><button onClick={()=>onChange({project:{...project,title:'합성 수정 원고'},design:initialDesign})}>원고 편집</button></section>}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('reuses document parsing/editor and saves/reopens JSON through explicit Electron API',async()=>{
 const now='2026-10-30T00:00:00.000Z',project=await createNewsletterProject({projectId:'synthetic-studio',title:'합성 원고',now});
 const doc={project,design:createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now})};
 let saved='';vi.stubGlobal('electronWork',{newsletter:{projects:{list:async()=>({ok:true,data:[]})},saveJson:async({json}:{json:string})=>{saved=json;return {ok:true,data:{saved:true,fileName:'synthetic.json'}};}}});
 const open=(json:string)=>{const f=new File([json],'synthetic.json');Object.defineProperty(f,'text',{value:async()=>json});fireEvent.change(screen.getByLabelText('원고·디자인 JSON 열기'),{target:{files:[f]}});};
 render(<NewsletterStudio onClose={()=>{}}/>);open(serializeStudioDocument(doc));await screen.findByRole('heading',{name:'합성 원고'});
 fireEvent.click(screen.getByRole('button',{name:'원고 편집'}));fireEvent.click(screen.getByRole('button',{name:'원고·디자인 JSON 저장'}));
 await waitFor(()=>expect(saved).toContain('합성 수정 원고'));expect(JSON.parse(saved).design).toEqual(doc.design);
 open(saved);await screen.findByRole('heading',{name:'합성 수정 원고'});
 open('invalid');await waitFor(()=>expect(document.querySelector('.newsletter-product-host > p[role="status"]')?.textContent).toMatch(/Unexpected|not valid|position/));expect(screen.getByRole('heading',{name:'합성 수정 원고'})).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Windows 원고 저장'})).toBeNull();
});

it('creates a selected month/school issue, keeps drafts across close/reopen, and does not autosave',async()=>{
 const saveJson=vi.fn(async(_r:{json:string})=>({ok:true,data:{saved:true,fileName:'new.json'}})),internalSave=vi.fn(),onClose=vi.fn();
 vi.stubGlobal('electronWork',{newsletter:{projects:{list:async()=>({ok:true,data:[]}),save:internalSave},saveJson}})
 const view=render(<NewsletterStudio onClose={onClose}/>);
 fireEvent.click(screen.getByRole('button',{name:'새 소식지 작성'}));fireEvent.change(screen.getByLabelText('작성 월'),{target:{value:'2027-03'}});fireEvent.change(screen.getByLabelText('학교 유형'),{target:{value:'girls-high'}});fireEvent.click(screen.getByRole('button',{name:'새 작성 취소'}));
 expect(screen.queryByRole('button',{name:'원고 편집'})).toBeNull();expect(saveJson).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'새 소식지 작성'}));expect((screen.getByLabelText('작성 월') as HTMLInputElement).value).toBe('2027-03');fireEvent.click(screen.getByRole('button',{name:'새 소식지 만들기'}));
 await screen.findByRole('heading',{name:'2027년 3월 · 여학교 보건소식지'});fireEvent.click(screen.getByRole('button',{name:'원고 편집'}));await screen.findByRole('heading',{name:'합성 수정 원고'});
 fireEvent.click(screen.getByRole('button',{name:'보건 업무로'}));expect(onClose).toHaveBeenCalledTimes(1);
 // Electron keeps the Studio mounted and hides its host when switching workspaces.
 view.rerender(<NewsletterStudio onClose={onClose}/>);expect(screen.getByRole('heading',{name:'합성 수정 원고'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'새 소식지 작성'}));fireEvent.change(screen.getByLabelText('학교 유형'),{target:{value:'boys-high'}});fireEvent.click(screen.getByRole('button',{name:'새 소식지 만들기'}));await screen.findByRole('heading',{name:'2027년 3월 · 남학교 보건소식지'});
 const first=(screen.getByLabelText('임시 보관 작업') as HTMLSelectElement).options[1]!.value;fireEvent.change(screen.getByLabelText('임시 보관 작업'),{target:{value:first}});fireEvent.click(screen.getByRole('button',{name:'임시 작업 다시 열기'}));await screen.findByRole('heading',{name:'합성 수정 원고'});
 expect(saveJson).not.toHaveBeenCalled();expect(internalSave).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'원고·디자인 JSON 저장'}));await waitFor(()=>expect(saveJson).toHaveBeenCalledTimes(1));
 const reopened=JSON.parse(saveJson.mock.calls[0]![0].json);expect(reopened.design.publicationMeta.issueLabel).toBe('2027년 3월 · 여학교');expect(reopened.design.assetManifest[0].exportApproval).toBe('pending');
})

it('archives an existing JSON project only after successful replacement; cancel and unsupported JSON leave it intact',async()=>{
 const now='2026-11-03T00:00:00.000Z',project=await createNewsletterProject({projectId:'protected-existing',title:'기존 원고',now}),doc={project,design:createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now})};
 const saveJson=vi.fn(async(_r:{json:string})=>({ok:true,data:{saved:true,fileName:'keep.json'}}));vi.stubGlobal('electronWork',{newsletter:{projects:{list:async()=>({ok:true,data:[]})},saveJson}})
 const open=(json:string)=>{const file=new File([json],'project.json');Object.defineProperty(file,'text',{value:async()=>json});fireEvent.change(screen.getByLabelText('원고·디자인 JSON 열기'),{target:{files:[file]}})}
 render(<NewsletterStudio onClose={()=>{}}/>);open(serializeStudioDocument(doc));await screen.findByRole('heading',{name:'기존 원고'});
 fireEvent.click(screen.getByRole('button',{name:'새 소식지 작성'}));fireEvent.click(screen.getByRole('button',{name:'새 작성 취소'}));expect(screen.getByRole('heading',{name:'기존 원고'})).toBeTruthy();
 open(JSON.stringify({...doc,unsupported:true}));await waitFor(()=>expect((screen.getByRole('button',{name:'원고·디자인 JSON 저장'}) as HTMLButtonElement).disabled).toBe(false));expect(screen.getByRole('heading',{name:'기존 원고'})).toBeTruthy();expect(screen.queryByLabelText('임시 보관 작업')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'새 소식지 작성'}));fireEvent.click(screen.getByRole('button',{name:'새 소식지 만들기'}));await screen.findByText(/새 소식지를 만들었습니다/);
 fireEvent.change(screen.getByLabelText('임시 보관 작업'),{target:{value:'1'}});fireEvent.click(screen.getByRole('button',{name:'임시 작업 다시 열기'}));await screen.findByRole('heading',{name:'기존 원고'});fireEvent.click(screen.getByRole('button',{name:'원고·디자인 JSON 저장'}));await waitFor(()=>expect(saveJson).toHaveBeenCalledTimes(1));expect(JSON.parse(saveJson.mock.calls[0]![0].json)).toEqual(doc)
})

it('restores the original internal project head when returning from a new issue',async()=>{
 const now='2026-11-03T00:00:00.000Z',project=await createNewsletterProject({projectId:'stored-existing',title:'저장된 원고',now}),doc={project,design:createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now})};
 const head={projectId:project.projectId,revision:3,hash:'a'.repeat(64)},record={head,document:serializeStudioDocument(doc)};
 const save=vi.fn(async(_r:unknown)=>({ok:true,data:record}));vi.stubGlobal('electronWork',{newsletter:{projects:{list:async()=>({ok:true,data:[project.projectId]}),load:async()=>({ok:true,data:record}),save}}});
 render(<NewsletterStudio onClose={()=>{}}/>);fireEvent.click(screen.getByText('Electron 프로젝트 저장·revision 이력'));fireEvent.change(screen.getByLabelText('불러올 프로젝트 ID'),{target:{value:project.projectId}});fireEvent.click(screen.getByRole('button',{name:'프로젝트 불러오기'}));await screen.findByRole('heading',{name:'저장된 원고'});await screen.findByText('프로젝트 불러옴 · revision 3 · 이미지 원본을 다시 연결해 주세요.');
 fireEvent.click(screen.getByRole('button',{name:'새 소식지 작성'}));fireEvent.click(screen.getByRole('button',{name:'새 소식지 만들기'}));await screen.findByText(/새 소식지를 만들었습니다/);
 fireEvent.change(screen.getByLabelText('임시 보관 작업'),{target:{value:'1'}});fireEvent.click(screen.getByRole('button',{name:'임시 작업 다시 열기'}));await screen.findByRole('heading',{name:'저장된 원고'});
 fireEvent.click(screen.getByRole('button',{name:'프로젝트 내부 저장'}));await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));expect(save.mock.calls[0]![0]).toMatchObject({expected:head});expect(JSON.parse((save.mock.calls[0]![0] as {document:string}).document)).toEqual(doc)
})

it('prevents a new issue from racing an outstanding internal project load',async()=>{
 const now='2026-11-03T00:00:00.000Z',project=await createNewsletterProject({projectId:'pending-existing',title:'지연 불러오기 원고',now}),doc={project,design:createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now})};
 let finish!:(value:unknown)=>void;const load=vi.fn(()=>new Promise(resolve=>{finish=resolve}));vi.stubGlobal('electronWork',{newsletter:{projects:{list:async()=>({ok:true,data:[]}),load}}});
 render(<NewsletterStudio onClose={()=>{}}/>);fireEvent.click(screen.getByText('Electron 프로젝트 저장·revision 이력'));fireEvent.change(screen.getByLabelText('불러올 프로젝트 ID'),{target:{value:project.projectId}});fireEvent.click(screen.getByRole('button',{name:'프로젝트 불러오기'}));
 expect((screen.getByRole('button',{name:'새 소식지 작성'}) as HTMLButtonElement).disabled).toBe(true);
 finish({ok:true,data:{head:{projectId:project.projectId,revision:1,hash:'a'.repeat(64)},document:serializeStudioDocument(doc)}});await screen.findByRole('heading',{name:'지연 불러오기 원고'});await waitFor(()=>expect((screen.getByRole('button',{name:'새 소식지 작성'}) as HTMLButtonElement).disabled).toBe(false))
})

it('rejects a host close request while a file operation is busy and accepts the next request after completion',async()=>{
 const now='2026-11-12T00:00:00.000Z',project=await createNewsletterProject({projectId:'busy-close',title:'작업 중 원고',now}),doc={project,design:createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now})};
 let finish!:(value:{ok:true;data:{saved:boolean;fileName:string}})=>void;const saveJson=vi.fn(()=>new Promise<{ok:true;data:{saved:boolean;fileName:string}}>(resolve=>{finish=resolve}));const onClose=vi.fn(),resolved=vi.fn();
 vi.stubGlobal('electronWork',{newsletter:{projects:{list:async()=>({ok:true,data:[]})},saveJson}});
 const view=render(<NewsletterStudio closeRequest={0} onCloseRequestResolved={resolved} onClose={onClose}/>);
 const file=new File([serializeStudioDocument(doc)],'busy.json');Object.defineProperty(file,'text',{value:async()=>serializeStudioDocument(doc)});fireEvent.change(screen.getByLabelText('원고·디자인 JSON 열기'),{target:{files:[file]}});await screen.findByRole('heading',{name:'작업 중 원고'});
 fireEvent.click(screen.getByRole('button',{name:'원고·디자인 JSON 저장'}));view.rerender(<NewsletterStudio closeRequest={1} onCloseRequestResolved={resolved} onClose={onClose}/>);
 await waitFor(()=>expect(resolved).toHaveBeenLastCalledWith(false));expect(onClose).not.toHaveBeenCalled();
 finish({ok:true,data:{saved:true,fileName:'busy.json'}});await waitFor(()=>expect((screen.getByRole('button',{name:'원고·디자인 JSON 저장'}) as HTMLButtonElement).disabled).toBe(false));
 view.rerender(<NewsletterStudio closeRequest={2} onCloseRequestResolved={resolved} onClose={onClose}/>);await waitFor(()=>expect(onClose).toHaveBeenCalledOnce());expect(resolved).toHaveBeenLastCalledWith(true);
})

it('rejects a host close request while a project operation is busy',async()=>{
 let finish!:(value:{ok:false;error:{code:'IO_ERROR';message:string}})=>void;const load=vi.fn(()=>new Promise<{ok:false;error:{code:'IO_ERROR';message:string}}>(resolve=>{finish=resolve}));const onClose=vi.fn(),resolved=vi.fn();
 vi.stubGlobal('electronWork',{newsletter:{projects:{list:async()=>({ok:true,data:['busy-project']}),load}}});
 const view=render(<NewsletterStudio closeRequest={0} onCloseRequestResolved={resolved} onClose={onClose}/>);fireEvent.click(screen.getByText('Electron 프로젝트 저장·revision 이력'));fireEvent.change(screen.getByLabelText('불러올 프로젝트 ID'),{target:{value:'busy-project'}});fireEvent.click(screen.getByRole('button',{name:'프로젝트 불러오기'}));
 view.rerender(<NewsletterStudio closeRequest={1} onCloseRequestResolved={resolved} onClose={onClose}/>);await waitFor(()=>expect(resolved).toHaveBeenLastCalledWith(false));expect(onClose).not.toHaveBeenCalled();
 finish({ok:false,error:{code:'IO_ERROR',message:'합성 프로젝트 실패'}});await screen.findByText('합성 프로젝트 실패');
})
