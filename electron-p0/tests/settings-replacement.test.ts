import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
vi.mock('node:fs/promises',async original=>{const actual=await original<typeof import('node:fs/promises')>();return {...actual,rename:vi.fn(actual.rename)}});
import {replaceSettingsFile} from '../main/settings';
afterEach(()=>vi.mocked(rename).mockReset());
async function files(){const root=await mkdtemp(join(tmpdir(),'settings-replacement-'));const temp=join(root,'pending.tmp'),target=join(root,'layout.json');await writeFile(temp,'new');await writeFile(target,'valid-old');return {root,temp,target};}
for(const code of ['EPERM'])it(`Windows ${code}: retries identical replacement and preserves the target until successful`,async()=>{
 const f=await files();const actual=await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
 try{vi.mocked(rename).mockImplementationOnce(async()=>{expect(await readFile(f.target,'utf8')).toBe('valid-old');throw Object.assign(new Error('synthetic lock'),{code})}).mockImplementation(actual.rename);
 await replaceSettingsFile(f.temp,f.target,'win32');expect(await readFile(f.target,'utf8')).toBe('new');expect(rename).toHaveBeenCalledTimes(2);expect(vi.mocked(rename).mock.calls).toEqual([[f.temp,f.target],[f.temp,f.target]]);
 }finally{await rm(f.root,{recursive:true,force:true})}
});
it('permanent Windows denial remains an error and preserves the previous valid bytes',async()=>{
 const f=await files();const error=Object.assign(new Error('synthetic permanent denial'),{code:'EPERM'});
 try{vi.mocked(rename).mockRejectedValue(error);await expect(replaceSettingsFile(f.temp,f.target,'win32')).rejects.toBe(error);expect(rename).toHaveBeenCalledTimes(4);expect(await readFile(f.target,'utf8')).toBe('valid-old');}finally{await rm(f.root,{recursive:true,force:true})}
});
for(const [platform,code] of [['linux','EPERM'],['win32','EIO'],['win32','EACCES'],['win32','EBUSY']] as const)it(`${platform} ${code} is not retried or disguised`,async()=>{
 const f=await files();const error=Object.assign(new Error('synthetic failure'),{code});try{vi.mocked(rename).mockRejectedValue(error);await expect(replaceSettingsFile(f.temp,f.target,platform)).rejects.toBe(error);expect(rename).toHaveBeenCalledTimes(1);expect(await readFile(f.target,'utf8')).toBe('valid-old');}finally{await rm(f.root,{recursive:true,force:true})}
});
