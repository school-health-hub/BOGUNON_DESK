// @vitest-environment jsdom
import {StrictMode} from 'react'
import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises'
import {dirname,join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {WidgetSessionProvider} from '../../src/dashboard/WidgetSessionContext'
import {LocalTaskStore,createLocalTaskHandlers} from '../main/local-tasks'
import {LocalWorkspaceProvider,useLocalWorkspace} from '../renderer/local-tasks/LocalWorkspaceProvider'
import {WorkspaceDataNotice} from '../renderer/local-tasks/LocalNotices'

it('does not label disconnected weather or meal data as a local storage failure',()=>{
 const view=render(<WorkspaceDataNotice state={{status:'signedOut'}}/> )
 expect(screen.getByRole('status').textContent).toContain('연결 전 상태')
 expect(screen.queryByText(/로컬 업무를 불러오지 못했습니다/)).toBeNull()
 view.rerender(<WorkspaceDataNotice state={{status:'error'}}/> )
 expect(screen.getByRole('status').textContent).toContain('로컬 업무를 불러오지 못했습니다')
})

const syntheticRoots:string[]=[]
async function syntheticRoot(){const root=await mkdtemp(join(tmpdir(),'local-workspace-startup-'));syntheticRoots.push(root);return root}
afterEach(async()=>{
 cleanup();vi.unstubAllGlobals()
 for(const root of syntheticRoots.splice(0)){
  if(dirname(resolve(root))!==resolve(tmpdir()))throw Error('Synthetic cleanup target escaped temp directory')
  await rm(root,{recursive:true})
 }
})

function StartupProbe(){
 const workspace=useLocalWorkspace()
 return <><output aria-label="workspace status">{workspace.state.status}</output>
  <output aria-label="task count">{workspace.document?.tasks.length??'unavailable'}</output>
  <output aria-label="recovered">{String(workspace.recovered)}</output>
  {workspace.error&&<p role="alert">{workspace.error}</p>}</>
}
function renderStartup(){
 return render(<StrictMode><WidgetSessionProvider><LocalWorkspaceProvider><StartupProbe/></LocalWorkspaceProvider></WidgetSessionProvider></StrictMode>)
}
function attachSyntheticStore(root:string){
 const url='file:///synthetic-local-workspace',frame={},contents={mainFrame:frame,getURL:()=>url}
 const handlers=createLocalTaskHandlers(contents,url,new LocalTaskStore(root))
 const save=vi.fn()
 vi.stubGlobal('electronWork',{tasks:{load:()=>handlers.load({sender:contents,senderFrame:frame}),save}})
 return save
}

it('treats a fresh isolated profile without task files as ready and empty in StrictMode',async()=>{
 const root=join(await syntheticRoot(),'missing-work-data','local-tasks')
 const save=attachSyntheticStore(root)
 renderStartup()
 await screen.findByText('ready')
 expect(screen.getByLabelText('task count').textContent).toBe('0')
 expect(screen.getByLabelText('recovered').textContent).toBe('false')
 expect(screen.queryByRole('alert')).toBeNull()
 expect(save).not.toHaveBeenCalled()
})

it('keeps corrupted synthetic task bytes and exposes an error instead of an empty success',async()=>{
 const root=await syntheticRoot()
 const original='SYNTHETIC INVALID TASK DOCUMENT'
 await writeFile(join(root,'tasks.json'),original)
 const url='file:///synthetic-local-workspace',frame={},contents={mainFrame:frame,getURL:()=>url}
 const handlers=createLocalTaskHandlers(contents,url,new LocalTaskStore(root))
 expect(await handlers.load({sender:contents,senderFrame:frame})).toMatchObject({ok:false,error:{code:'STORAGE_ERROR'}})
 const save=attachSyntheticStore(root)
 renderStartup()
 await screen.findByRole('alert')
 expect(screen.getByLabelText('workspace status').textContent).toBe('error')
 expect(screen.getByLabelText('task count').textContent).toBe('unavailable')
 expect(await readFile(join(root,'tasks.json'),'utf8')).toBe(original)
 expect(save).not.toHaveBeenCalled()
})

it('does not turn a denied IPC load into a fresh-profile empty state',async()=>{
 const root=await syntheticRoot(),url='file:///synthetic-local-workspace',frame={},contents={mainFrame:frame,getURL:()=>url}
 const handlers=createLocalTaskHandlers(contents,url,new LocalTaskStore(root))
 const denied=await handlers.load({sender:contents,senderFrame:{}})
 expect(denied).toMatchObject({ok:false,error:{code:'FORBIDDEN'}})
 const save=vi.fn()
 vi.stubGlobal('electronWork',{tasks:{load:async()=>denied,save}})
 renderStartup()
 await screen.findByRole('alert')
 expect(screen.getByLabelText('workspace status').textContent).toBe('error')
 expect(screen.getByLabelText('task count').textContent).toBe('unavailable')
 expect(save).not.toHaveBeenCalled()
})
