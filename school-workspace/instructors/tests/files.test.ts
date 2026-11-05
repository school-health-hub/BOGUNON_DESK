import {it,expect,afterEach,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,readdir,symlink,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {PNG} from 'pngjs';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {InstructorStampStore,stampDimensions} from '../../../electron-p0/main/instructor-stamp.js';
import {createInstructorFiles,readInstructorFile,type InstructorFilePorts} from '../../../electron-p0/main/instructor-files.js';
const roots:string[]=[];afterEach(async()=>{for(const r of roots.splice(0))await rm(r,{recursive:true,force:true});});
async function root(){const r=await mkdtemp(join(tmpdir(),'bogunon-instructor02-test-'));roots.push(r);return r;}
const user='00000000-0000-0000-0000-000000000003',other='00000000-0000-0000-0000-000000000004',school='10000000-0000-0000-0000-000000000001';
function png(){const p=new PNG({width:32,height:48});p.data.fill(0);p.data[0]=200;p.data[3]=128;return PNG.sync.write(p);}
function cipher(){const key=randomBytes(32);return{available:true,encrypt:(s:string)=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);const b=Buffer.concat([c.update(s,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),b]);},decrypt:(b:Buffer)=>{const c=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));c.setAuthTag(b.subarray(12,28));return Buffer.concat([c.update(b.subarray(28)),c.final()]).toString();}};}
it('MOCK secure-storage encryption, transparent PNG ratio, account/profile isolation, replacement/deletion and restart',async()=>{
 const r=await root(),c=cipher(),store=new InstructorStampStore(join(r,'private'),c),bytes=png();await store.save(user,bytes);const view=await new InstructorStampStore(join(r,'private'),c).read(user);expect(view).toMatchObject({width:32,height:48});expect(PNG.sync.read(Buffer.from(view!.dataUrl.split(',')[1],'base64')).data[3]).toBe(128);
 expect(await store.read(other)).toBeNull();expect(await new InstructorStampStore(join(r,'other-qa-profile'),c).read(user)).toBeNull();
 const dirs=await readdir(join(r,'private'));const disk=await readFile(join(r,'private',dirs[0],'stamp.json'),'utf8');expect(disk).not.toContain(bytes.toString('base64'));
 await expect(store.save(user,Buffer.from('<svg/>'))).rejects.toThrow();expect((await store.read(user))?.dataUrl).toBe(view?.dataUrl);
 c.encrypt=()=>{throw Error('synthetic encryption failure');};await expect(store.save(user,bytes)).rejects.toThrow();expect((await store.read(user))?.dataUrl).toBe(view?.dataUrl);
 await store.remove(user);expect(await store.read(user)).toBeNull();
});
it('image header limits reject HTML/SVG/corrupt/oversized/decompression dimensions and symlinks',async()=>{
 for(const b of [Buffer.from('<html>'),Buffer.from('<svg/>'),Buffer.alloc(2*1024*1024+1),png().subarray(0,30)])expect(()=>stampDimensions(b)).toThrow();
 const huge=Buffer.from(png());huge.writeUInt32BE(999999,16);expect(()=>stampDimensions(huge)).toThrow();
 const r=await root(),p=join(r,'source.png');await writeFile(p,png());await symlink(p,join(r,'link.png'));await expect(readInstructorFile(join(r,'link.png'),2*1024*1024,['.png'])).rejects.toThrow();
 await expect(new InstructorStampStore(join(r,'private'),{...cipher(),available:false}).read(user)).rejects.toThrow();
});
const contents={mainFrame:{},getURL:()=> 'http://127.0.0.1:5174/'},event={sender:contents,senderFrame:contents.mainFrame};
async function rig(){const r=await root(),path=join(r,'stamp.png');await writeFile(path,png());const store=new InstructorStampStore(join(r,'private'),cipher());const ports:InstructorFilePorts={authorize:async()=>({user,generation:0}),board:async()=>({phase:'ready',board:{version:1,instructor:{id:user},logs:[]}}),stamp:store,protectedRoot:join(r,'private'),pick:async()=>path,save:async()=>undefined,confirm:async()=>true,decode:bytes=>PNG.sync.write(PNG.sync.read(bytes)),print:vi.fn(async()=>true)};return{ports,store,life:createInstructorFiles(contents,contents.getURL(),ports)};}
const req={school,month:'2026-08',version:1};
it('Main selected PNG upload/preview; cancellation preserves stamp and print cancel calls no printer',async()=>{
 const {life,ports,store}=await rig();expect(await life.handlers.stampPick(event,req)).toMatchObject({ok:true,status:'saved',data:{width:32,height:48}});const old=await store.read(user);
 ports.pick=async()=>undefined;expect(await life.handlers.stampPick(event,req)).toMatchObject({ok:true,status:'canceled'});expect(await store.read(user)).toEqual(old);
 ports.confirm=async()=>false;expect(await life.handlers.print(event,{...req,kind:'attendance',includeStamp:false})).toMatchObject({ok:true,status:'canceled'});expect(ports.print).not.toHaveBeenCalled();
 expect(await life.handlers.print(event,{...req,kind:'payment',includeStamp:true})).toMatchObject({ok:false});
});
it('Main assistant/foreign sender/path injection/late account response are blocked; no private data returned',async()=>{
 const {life,ports}=await rig();expect(await life.handlers.stampRead({sender:{},senderFrame:{}},req)).toMatchObject({ok:false});expect(await life.handlers.stampRead(event,{...req,path:'/tmp/arbitrary'})).toMatchObject({ok:false});
 ports.authorize=async()=>{throw Error('assistant');};expect(await life.handlers.stampRead(event,req)).toMatchObject({ok:false});
 let count=0;ports.authorize=async()=>({user:++count<3?user:other,generation:count<3?0:1});expect(await life.handlers.stampPick(event,req)).toMatchObject({ok:false});
});

it('synthetic JPEG upload uses bounded header validation and normalized PNG output; source bytes unchanged',async()=>{
 const {life,ports,store}=await rig(),r=await root(),path=join(r,'synthetic.jpg'),jpg=await readFile('school-workspace/instructors/tests/fixtures/synthetic-stamp.jpg');await writeFile(path,jpg);ports.pick=async()=>path;ports.decode=()=>png();
 expect(stampDimensions(jpg)).toEqual({width:32,height:48});expect(await life.handlers.stampPick(event,req)).toMatchObject({ok:true,status:'saved'});expect((await store.read(user))?.dataUrl.startsWith('data:image/png')).toBe(true);expect(await readFile(path)).toEqual(jpg);
});

it('dispose stops waiting on an owned dialog, flush completes and late selection never writes',async()=>{
 const {life,ports,store}=await rig();let selected!:(v:string|undefined)=>void;ports.pick=()=>new Promise(r=>selected=r);const pending=life.handlers.stampPick(event,req);await vi.waitFor(()=>expect(selected).toBeTypeOf('function'));life.dispose();await life.flush();expect(await pending).toMatchObject({ok:false});selected(undefined);expect(await store.read(user)).toBeNull();
});
