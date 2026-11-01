// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {NewsletterProjectControls} from '../renderer/adapters/NewsletterProjectControls';
import {createNewsletterProject} from '../../src/newsletter/project';import {createNewsletterDesignState} from '../../src/newsletter/rendering/designSchema';import {serializeStudioDocument} from '../../src/newsletter/studioDocument';
const now='2026-10-30T00:00:00.000Z';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
async function fixture(){const project=await createNewsletterProject({projectId:'synthetic-controls',title:'합성 원고',now});return {project,design:createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now})};}
it('saves with an explicit expected head and retains the current document on conflict',async()=>{
 const doc=await fixture(),record={head:{projectId:doc.project.projectId,revision:1,hash:'a'.repeat(64)},document:serializeStudioDocument(doc)};
 const api={list:vi.fn(async()=>({ok:true,data:[doc.project.projectId]})),save:vi.fn().mockResolvedValueOnce({ok:true,data:record}).mockResolvedValueOnce({ok:false,error:{code:'CONFLICT',message:'충돌: 다시 불러와 주세요.',retryable:false}})};
 vi.stubGlobal('electronWork',{newsletter:{projects:api}});const onSaved=vi.fn();
 render(<NewsletterProjectControls document={doc} head={null} onLoaded={vi.fn()} onSaved={onSaved} onPreview={vi.fn()}/>);document.querySelector('details')!.open=true;
 await waitFor(()=>expect(api.list).toHaveBeenCalled());
 fireEvent.click(screen.getByRole('button',{name:'프로젝트 내부 저장'}));await waitFor(()=>expect(onSaved).toHaveBeenCalledWith(record));
 expect(api.save.mock.calls[0][0].expected).toEqual({projectId:doc.project.projectId,revision:0,hash:''});
 fireEvent.click(screen.getByRole('button',{name:'프로젝트 내부 저장'}));await screen.findByText('충돌: 다시 불러와 주세요.');expect(onSaved).toHaveBeenCalledTimes(1);expect(serializeStudioDocument(doc)).toBe(record.document);
});
it('opens read-only preview and only loads a restored record after confirmed backend success',async()=>{
 const doc=await fixture(),record={head:{projectId:doc.project.projectId,revision:2,hash:'a'.repeat(64)},document:serializeStudioDocument(doc)},preview={token:'11111111-1111-4111-8111-111111111111',head:record.head,revision:1,document:record.document};
 const api={list:vi.fn(async()=>({ok:true,data:[doc.project.projectId]})),history:vi.fn(async()=>({ok:true,data:[{revision:1,hash:'b'.repeat(64),createdAt:now}]})),preview:vi.fn(async()=>({ok:true,data:preview})),restore:vi.fn().mockResolvedValueOnce({ok:true,data:{restored:false}}).mockResolvedValueOnce({ok:true,data:{restored:true,record}})};
 vi.stubGlobal('electronWork',{newsletter:{projects:api}});const onLoaded=vi.fn(),onPreview=vi.fn();
 render(<NewsletterProjectControls document={doc} head={record.head} onLoaded={onLoaded} onSaved={vi.fn()} onPreview={onPreview}/>);document.querySelector('details')!.open=true;
 await waitFor(()=>expect(screen.getByLabelText('불러올 프로젝트 ID')).toHaveProperty('value',doc.project.projectId));
 fireEvent.click(screen.getByRole('button',{name:'revision 이력 조회'}));await screen.findByRole('button',{name:'revision 1 미리보기'});
 fireEvent.click(screen.getByRole('button',{name:'revision 1 미리보기'}));await waitFor(()=>expect(onPreview).toHaveBeenCalledWith(preview));expect(onLoaded).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'미리 본 revision 복구'}));await screen.findByText('복구를 취소했습니다.');expect(onLoaded).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'revision 1 미리보기'}));await screen.findByRole('button',{name:'미리 본 revision 복구'});fireEvent.click(screen.getByRole('button',{name:'미리 본 revision 복구'}));await waitFor(()=>expect(onLoaded).toHaveBeenCalledWith(record));expect(api.preview).toHaveBeenCalledTimes(2);
});
