import {afterEach,it,expect,vi} from 'vitest';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink,chmod,readdir} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';import ts from 'typescript';
import {WorkFoldersStore,validateWorkFolders,inspectLocalFolder,localFolderPath,FolderError} from '../main/work-folders';
import {createWorkFolderHandlers,validateMemoUrl} from '../main/work-folders-ipc';
const roots:string[]=[];
async function root(){const p=await mkdtemp(join(tmpdir(),'desk-folders-'));roots.push(p);return p;}
afterEach(async()=>{vi.restoreAllMocks();for(const path of roots.splice(0))await rm(path,{recursive:true,force:true});});
const url='file:///renderer/index.html',frame={},contents={mainFrame:frame,getURL:()=>url},event={sender:contents,senderFrame:frame};
async function setup(){const d=await root(),a=join(d,'합성 업무'),b=join(d,'합성 활동'),storage=join(d,'store');await mkdir(a);await mkdir(b);const store=new WorkFoldersStore(storage),pick=vi.fn(async():Promise<string|undefined>=>a),openPath=vi.fn(async()=>''),openExternal=vi.fn(async(_url:string)=>{}),confirmRemove=vi.fn(async()=>true);const h=createWorkFolderHandlers(contents,url,store,{pick,openPath,openExternal,confirmRemove});return {d,a,b,storage,store,pick,openPath,openExternal,confirmRemove,h};}
async function data<T>(result:Promise<{ok:true;data:T}|{ok:false;error:unknown}>){const r=await result;expect(r.ok).toBe(true);if(!r.ok)throw Error();return r.data;}
it('preserves the original twelve favorites/name/order contract through CRUD, restart and confirmed removal',async()=>{
 const c=await setup();expect((await data(c.h.load(event))).favorites).toEqual([]);let state=await data(c.h.pick(event,{expectedRevision:0}));expect(state!.revision).toBe(1);const id=state!.favorites[0].id;expect(state!.favorites[0]).toMatchObject({path:c.a,name:'합성 업무',available:true});
 c.pick.mockResolvedValue(c.b);state=await data(c.h.pick(event,{expectedRevision:1}));const second=state!.favorites[1].id;state=await data(c.h.rename(event,{id,name:'  검진 업무  ',expectedRevision:2}));expect(state!.favorites[0].name).toBe('검진 업무');state=await data(c.h.reorder(event,{ids:[second,id],expectedRevision:3}));expect(state!.favorites.map(f=>f.id)).toEqual([second,id]);
 const reopened=await new WorkFoldersStore(c.storage).load();expect(reopened.document.revision).toBe(4);expect(reopened.document.favorites.map(f=>f.id)).toEqual([second,id]);
 await data(c.h.open(event,{id}));expect(c.openPath).toHaveBeenCalledExactlyOnceWith(c.a);
 c.confirmRemove.mockResolvedValueOnce(false);expect(await data(c.h.remove(event,{id,expectedRevision:4,confirmed:true}))).toBeNull();expect((await c.store.load()).document).toEqual(reopened.document);
 state=await data(c.h.remove(event,{id,expectedRevision:4,confirmed:true}));expect(state!.favorites.map(f=>f.id)).toEqual([second]);expect(await readFile(join(c.storage,'favorites.backup.json'),'utf8')).toContain('검진 업무');expect(await inspectLocalFolder(c.a)).toBe(c.a);
});
it('canceling selection and rejecting duplicate/name/order/revision requests preserves prior favorites',async()=>{
 const c=await setup(),state=await data(c.h.pick(event,{expectedRevision:0})),id=state!.favorites[0].id,before=await readFile(join(c.storage,'favorites.json'),'utf8');
 expect(await c.h.pick(event,{expectedRevision:1})).toMatchObject({ok:false,error:{code:'CONFLICT'}});c.pick.mockResolvedValue(undefined);expect(await data(c.h.pick(event,{expectedRevision:1}))).toBeNull();
 for(const request of [{id,name:'',expectedRevision:1},{id,name:'가'.repeat(41),expectedRevision:1},{id,name:'foo\nbar',expectedRevision:1},{id,name:'새 이름',expectedRevision:0}])expect(await c.h.rename(event,request)).toMatchObject({ok:false});
 expect(await c.h.reorder(event,{ids:[id,id],expectedRevision:1})).toMatchObject({ok:false});expect(await c.h.reorder(event,{ids:[],expectedRevision:1})).toMatchObject({ok:false});expect(await c.h.remove(event,{id,expectedRevision:1,confirmed:false})).toMatchObject({ok:false});expect(c.confirmRemove).not.toHaveBeenCalled();expect(await readFile(join(c.storage,'favorites.json'),'utf8')).toBe(before);
});
it('enforces twelve folders and serializes conflicting writes',async()=>{
 const c=await setup();for(let i=0;i<12;i++){const path=join(c.d,`합성-${i}`);await mkdir(path);c.pick.mockResolvedValue(path);expect(await c.h.pick(event,{expectedRevision:i})).toMatchObject({ok:true});}
 c.pick.mockResolvedValue(c.a);expect(await c.h.pick(event,{expectedRevision:12})).toMatchObject({ok:false});const current=await c.store.load(),id=current.document.favorites[0].id;
 const writes=await Promise.all([c.h.rename(event,{id,name:'첫 변경',expectedRevision:12}),c.h.rename(event,{id,name:'충돌 변경',expectedRevision:12})]);expect(writes.filter(r=>r.ok)).toHaveLength(1);expect(writes.find(r=>!r.ok)).toMatchObject({error:{code:'CONFLICT'}});expect((await c.store.load()).document.favorites[0].name).toBe('첫 변경');
});
it('preserves corrupt/unsupported files and only exposes a valid backup read-only',async()=>{
 const c=await setup();await data(c.h.pick(event,{expectedRevision:0}));const original=await readFile(join(c.storage,'favorites.json'),'utf8');await writeFile(join(c.storage,'favorites.json'),'{broken');expect(await c.h.load(event)).toMatchObject({ok:false});expect(await readFile(join(c.storage,'favorites.json'),'utf8')).toBe('{broken');expect(await c.h.pick(event,{expectedRevision:0})).toMatchObject({ok:false});
 await writeFile(join(c.storage,'favorites.backup.json'),original);expect(await data(c.h.load(event))).toMatchObject({recovered:true,revision:1});const unsupported=JSON.stringify({version:9,revision:1,favorites:[]});await writeFile(join(c.storage,'favorites.json'),unsupported);expect(await data(c.h.load(event))).toMatchObject({recovered:true});expect(await c.h.rename(event,{id:'missing',name:'변경',expectedRevision:1})).toMatchObject({ok:false});expect(await readFile(join(c.storage,'favorites.json'),'utf8')).toBe(unsupported);
});
it('keeps last good primary and backup after write failure with no temporary files left',async()=>{
 const c=await setup();await data(c.h.pick(event,{expectedRevision:0}));const before=await readFile(join(c.storage,'favorites.json'),'utf8');const broken=new WorkFoldersStore(c.storage,async()=>{throw Error('synthetic disk full');});await expect(broken.mutate(1,items=>items.map(f=>({...f,name:'저장 실패'})))).rejects.toThrow();expect(await readFile(join(c.storage,'favorites.json'),'utf8')).toBe(before);expect(await readFile(join(c.storage,'favorites.backup.json'),'utf8')).toBe(before);expect(await readdir(c.storage)).toEqual(expect.arrayContaining(['favorites.json','favorites.backup.json']));expect((await readdir(c.storage)).some(f=>f.endsWith('.tmp'))).toBe(false);
});
it('refuses symlinked storage roots/files instead of overwriting another local file',async()=>{
 const c=await setup(),target=join(c.d,'original.json');await writeFile(target,'synthetic original');await mkdir(c.storage);await symlink(target,join(c.storage,'favorites.json'));expect(await c.h.load(event)).toMatchObject({ok:false});expect(await c.h.pick(event,{expectedRevision:0})).toMatchObject({ok:false});expect(await readFile(target,'utf8')).toBe('synthetic original');
 const linked=join(c.d,'linked-store');await symlink(c.storage,linked,'junction');await expect(new WorkFoldersStore(linked).load()).rejects.toThrow();
});
it('rejects oversized storage and unknown persisted fields without clearing the file',async()=>{
 const c=await setup();await mkdir(c.storage);const oversized=' '.repeat(65537);await writeFile(join(c.storage,'favorites.json'),oversized);expect(await c.h.load(event)).toMatchObject({ok:false});expect(await readFile(join(c.storage,'favorites.json'),'utf8')).toBe(oversized);
 const unknown=JSON.stringify({version:1,revision:0,favorites:[{id:'folder-safe',name:'합성',path:c.a,command:'blocked'}]});await writeFile(join(c.storage,'favorites.json'),unknown);expect(await c.h.load(event)).toMatchObject({ok:false});expect(await readFile(join(c.storage,'favorites.json'),'utf8')).toBe(unknown);
});
it('reports moved/missing folders and refuses ordinary files, shortcuts, symlinks and linked ancestors',async()=>{
 const c=await setup(),state=await data(c.h.pick(event,{expectedRevision:0})),id=state!.favorites[0].id;await rm(c.a,{recursive:true});expect((await data(c.h.load(event))).favorites[0]).toMatchObject({available:false,unavailableReason:expect.stringContaining('찾을 수 없습니다')});expect(await c.h.open(event,{id})).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});expect(c.openPath).not.toHaveBeenCalled();
 const file=join(c.d,'file.txt'),shortcut=join(c.d,'shortcut.lnk'),link=join(c.d,'link');await writeFile(file,'synthetic');await writeFile(shortcut,'synthetic shortcut');await symlink(c.b,link,'junction');for(const p of [file,shortcut,link]){c.pick.mockResolvedValue(p);expect(await c.h.pick(event,{expectedRevision:1})).toMatchObject({ok:false});}await mkdir(join(c.b,'child'));await expect(inspectLocalFolder(join(link,'child'))).rejects.toThrow();
});
it.skipIf(process.platform==='win32'||process.getuid?.()===0)('reports actual denied directory access without invoking the opener',async()=>{
 const c=await setup(),state=await data(c.h.pick(event,{expectedRevision:0}));await chmod(c.a,0);try{expect(await c.h.open(event,{id:state!.favorites[0].id})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(c.openPath).not.toHaveBeenCalled();}finally{await chmod(c.a,0o700);}
});
it('distinguishes access denial and OS open failure without passing arbitrary paths or commands',async()=>{
 const c=await setup(),state=await data(c.h.pick(event,{expectedRevision:0})),id=state!.favorites[0].id;
 const denied=createWorkFolderHandlers(contents,url,c.store,{pick:c.pick,openPath:c.openPath,openExternal:c.openExternal,confirmRemove:c.confirmRemove,inspect:async()=>{throw new FolderError('FORBIDDEN','폴더 접근이 거부됐습니다.');}});expect(await denied.open(event,{id})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(c.openPath).not.toHaveBeenCalled();
 c.openPath.mockResolvedValue('synthetic OS error');expect(await c.h.open(event,{id})).toMatchObject({ok:false,error:{code:'INTERNAL_ERROR'}});expect(await c.h.open(event,{path:c.b})).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});expect(await c.h.open(event,{id,command:'explorer'})).toMatchObject({ok:false});expect(c.openPath).toHaveBeenCalledTimes(1);
});
it.each(['\\\\server\\share','\\\\?\\C:\\work','\\\\.\\C:\\work','C:relative','C:\\work\\..\\other','C:\\work:stream','C:\\AUX','C:\\work.lnk','C:\\work.url'])('rejects Windows unsafe path %s independently of Cloud OS',path=>{expect(()=>localFolderPath(path,'win32')).toThrow();});
it('accepts canonical Windows drive folders but never restores unknown schema or unsafe paths',()=>{
 expect(localFolderPath('F:\\업무\\검진','win32')).toBe('F:\\업무\\검진');expect(validateWorkFolders({version:1,revision:0,favorites:[]})).toEqual({version:1,revision:0,favorites:[]});for(const value of [{version:2,revision:0,favorites:[]},{version:1,revision:0,favorites:[],extra:true},{version:1,revision:0,favorites:[{id:'folder-1',name:'이름',path:'relative'}]}])expect(()=>validateWorkFolders(value)).toThrow();
});
it.each(['javascript:alert(1)','file:///C:/file','data:text/plain,hi','mailto:synthetic@example.test','https://user:secret@example.test','https://example.test\\evil','http://','example.test','https://example.test\n--command'])('blocks unsafe memo URL %s without opening a browser',async value=>{const c=await setup();expect(()=>validateMemoUrl(value)).toThrow();expect(await c.h.openMemoUrl(event,{url:value})).toMatchObject({ok:false});expect(c.openExternal).not.toHaveBeenCalled();});
it('allows only explicit http/https browser requests and reports launcher failure',async()=>{
 const c=await setup();expect(c.openExternal).not.toHaveBeenCalled();await data(c.h.openMemoUrl(event,{url:'https://example.test/합성?q=1'}));expect(c.openExternal).toHaveBeenCalledExactlyOnceWith(new URL('https://example.test/합성?q=1').href);await data(c.h.openMemoUrl(event,{url:'http://example.test/'}));c.openExternal.mockRejectedValueOnce(Error('synthetic'));expect(await c.h.openMemoUrl(event,{url:'https://example.test/'})).toMatchObject({ok:false,error:{code:'INTERNAL_ERROR'}});
});
it('rejects forged sender/frame/extra args and ignores late picker results after window disposal',async()=>{
 const c=await setup();for(const caller of [{...event,sender:{}},{...event,senderFrame:{}}]){expect(await c.h.pick(caller,{expectedRevision:0})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await c.h.openMemoUrl(caller,{url:'https://example.test/'})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});}expect(await c.h.pick(event,{expectedRevision:0,path:c.a})).toMatchObject({ok:false});expect(await c.h.load(event,'extra')).toMatchObject({ok:false});expect(c.pick).not.toHaveBeenCalled();let finish!:(v:string)=>void;c.pick.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));const pending=c.h.pick(event,{expectedRevision:0});c.h.dispose();finish(c.a);expect(await pending).toMatchObject({ok:false});expect((await c.store.load()).document.revision).toBe(0);expect(c.openExternal).not.toHaveBeenCalled();
});
it('preload exposes frozen typed methods and no filesystem/command/path selection escape hatch',async()=>{
 const exposed:Record<string,any>={},invoke=vi.fn(async()=>({ok:true,data:null})),code=ts.transpileModule(readFileSync('electron-p0/preload/preload.cts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{exports:{},process:{sandboxed:true,contextIsolated:true},require:()=>({contextBridge:{exposeInMainWorld:(key:string,v:unknown)=>{exposed[key]=v;}},ipcRenderer:{invoke}})});
 const api=exposed.electronWork.workFolders;expect(Object.isFrozen(api)).toBe(true);expect(Object.keys(api)).toEqual(['load','pick','rename','remove','reorder','open']);expect(api.readFile).toBeUndefined();expect(api.exec).toBeUndefined();await api.load('forged');expect(invoke.mock.calls.at(-1)).toEqual(['p2:work-folders:load']);await api.open({id:'folder-1'});expect(invoke.mock.calls.at(-1)).toEqual(['p2:work-folders:open',{id:'folder-1'}]);expect(Object.isFrozen(exposed.electronWork.memoLinks)).toBe(true);await exposed.electronWork.memoLinks.open({url:'https://example.test/'});expect(invoke.mock.calls.at(-1)).toEqual(['p2:memo:open-url',{url:'https://example.test/'}]);
});
