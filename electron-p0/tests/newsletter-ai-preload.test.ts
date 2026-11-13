import {expect,it,vi} from 'vitest'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'

type TestNewsletterAiBridge=Readonly<Record<'status'|'proposeText'|'generateImageCandidate'|'cancel'|'discardCandidate'|'previewCandidate'|'commitCandidateAsset'|'commitCandidateAssets'|'loadProjectAssets',(request?:unknown)=>Promise<unknown>>>
function hasNewsletterAiBridge(value:unknown):value is Readonly<{newsletter:Readonly<{ai:TestNewsletterAiBridge}>}>{
  if(typeof value!=='object'||value===null||!('newsletter' in value))return false
  const newsletter=value.newsletter
  if(typeof newsletter!=='object'||newsletter===null||!('ai' in newsletter))return false
  const ai=newsletter.ai
  return typeof ai==='object'&&ai!==null&&'status' in ai&&typeof ai.status==='function'&&'proposeText' in ai&&typeof ai.proposeText==='function'&&'generateImageCandidate' in ai&&typeof ai.generateImageCandidate==='function'&&'cancel' in ai&&typeof ai.cancel==='function'&&'discardCandidate' in ai&&typeof ai.discardCandidate==='function'&&'previewCandidate' in ai&&typeof ai.previewCandidate==='function'
}

it('exposes only named Newsletter AI methods without generic invoke, keys or paths',async()=>{
  // Given
  const exposed:Record<string,unknown>={}
  const invoke=vi.fn(async()=>({ok:true,data:null}))
  const code=ts.transpileModule(readFileSync('electron-p0/preload/preload.cts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  runInNewContext(code,{exports:{},window:undefined,document:undefined,process:{sandboxed:true,contextIsolated:true,isMainFrame:true},require:(name:string)=>{
    if(name!=='electron')throw new Error('Unexpected dependency')
    return {contextBridge:{exposeInMainWorld:(name:string,value:unknown)=>{exposed[name]=value}},ipcRenderer:{invoke,on:vi.fn(),removeListener:vi.fn()},webUtils:{}}
  }})
  const work=exposed.electronWork
  if(!hasNewsletterAiBridge(work))throw new TypeError('Newsletter AI preload bridge missing')
  // When
  const bridge=work.newsletter.ai
  // Then
  expect(Object.isFrozen(bridge)).toBe(true)
  expect(Object.keys(bridge).sort()).toEqual(['cancel','commitCandidateAsset','commitCandidateAssets','discardCandidate','generateImageCandidate','loadProjectAssets','previewCandidate','proposeText','status'].sort())
  await bridge.status()
  expect(invoke).toHaveBeenLastCalledWith('p2:newsletter:ai:status')
  for(const method of ['proposeText','generateImageCandidate','cancel','discardCandidate','previewCandidate','commitCandidateAsset','commitCandidateAssets','loadProjectAssets'] as const){
    const request={requestId:'request-1'}
    await bridge[method](request)
    expect(invoke).toHaveBeenLastCalledWith(`p2:newsletter:ai:${method}`,request)
  }
  expect(JSON.stringify(bridge)).not.toMatch(/apiKey|path|invoke/)
})

it('registers every named channel in Main and disposes candidate bytes with the window',()=>{
  // Given
  const main=readFileSync('electron-p0/main/main.mts','utf8')
  // When / Then
  expect(main).toContain("for(const action of NEWSLETTER_AI_ACTIONS)ipcMain.handle(`p2:newsletter:ai:${action}`")
  expect(main).toContain("window.on('closed',()=>{newsletterAiCandidates.dispose();newsletterAiAuthority.disposeOwner(window.webContents.id);})")
  expect(main).toContain("window.webContents.on('will-navigate',()=>{newsletterAiCandidates.dispose();newsletterAiAuthority.disposeOwner(window.webContents.id);})")
  expect(main).toContain("window.webContents.on('render-process-gone',()=>{newsletterAiCandidates.dispose();newsletterAiAuthority.disposeOwner(window.webContents.id);})")
})
