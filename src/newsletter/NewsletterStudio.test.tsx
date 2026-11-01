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
 let saved='';vi.stubGlobal('electronWork',{newsletter:{saveJson:async({json}:{json:string})=>{saved=json;return {ok:true,data:{saved:true,fileName:'synthetic.json'}};}}});
 const open=(json:string)=>{const f=new File([json],'synthetic.json');Object.defineProperty(f,'text',{value:async()=>json});fireEvent.change(screen.getByLabelText('원고·디자인 JSON 열기'),{target:{files:[f]}});};
 render(<NewsletterStudio onClose={()=>{}}/>);open(serializeStudioDocument(doc));await screen.findByRole('heading',{name:'합성 원고'});
 fireEvent.click(screen.getByRole('button',{name:'원고 편집'}));fireEvent.click(screen.getByRole('button',{name:'원고·디자인 JSON 저장'}));
 await waitFor(()=>expect(saved).toContain('합성 수정 원고'));expect(JSON.parse(saved).design).toEqual(doc.design);
 open(saved);await screen.findByRole('heading',{name:'합성 수정 원고'});
 open('invalid');await screen.findByRole('status');expect(screen.getByRole('heading',{name:'합성 수정 원고'})).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Windows 원고 저장'})).toBeNull();
});
