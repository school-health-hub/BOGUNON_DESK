import {it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createNewsletterSaveHandler,writeSelectedJson,validateNewsletterSave} from '../main/newsletter-json';
const json=JSON.stringify({project:{schemaVersion:1,projectId:'synthetic',projectRevision:1,revisionHistory:[]},design:{designSchemaVersion:2,projectId:'synthetic',designRevision:1,canonicalProjectRevision:1,revisionHistory:[]}});
it('rejects untrusted window/frame/URL and invalid/oversized/path requests before picker',async()=>{
 const frame={},wc={mainFrame:frame,getURL:()=> 'file:///test'},pick=vi.fn(),h=createNewsletterSaveHandler(wc,'file:///test',{pick,confirm:async()=>true});
 for(const e of [{sender:{},senderFrame:frame},{sender:wc,senderFrame:{}}])expect(await h(e,{json})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 const other={...wc,getURL:()=> 'https://evil.invalid'};expect(await createNewsletterSaveHandler(other,'file:///test',{pick,confirm:async()=>true})({sender:other,senderFrame:frame},{json})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 for(const v of [null,{json:'invalid'},{json,path:'C:/any'},{json:'x'.repeat(8*1024*1024+1)},{json:'{}'}])expect(await h({sender:wc,senderFrame:frame},v)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 expect(pick).not.toHaveBeenCalled();expect(validateNewsletterSave({json})).toBe(json);
});
it('requires overwrite approval, preserves originals on failure and detects changes during confirmation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'newsletter-json-')),path=join(dir,'synthetic.json');await writeFile(path,'SYNTHETIC ORIGINAL');
 expect(await writeSelectedJson(path,json,async()=>false)).toEqual({saved:false});expect(await readFile(path,'utf8')).toBe('SYNTHETIC ORIGINAL');
 await expect(writeSelectedJson(path,json,async()=>true,async()=>{throw Error('SYNTHETIC RENAME FAILURE');})).rejects.toThrow();
 expect(await readFile(path,'utf8')).toBe('SYNTHETIC ORIGINAL');expect(await readdir(dir)).toEqual(['synthetic.json']);
 await expect(writeSelectedJson(path,json,async()=>{await writeFile(path,'SYNTHETIC CONCURRENT');return true;})).rejects.toThrow('Target changed');
 expect(await readFile(path,'utf8')).toBe('SYNTHETIC CONCURRENT');
 expect(await writeSelectedJson(path,json,async()=>true)).toEqual({saved:true,fileName:'synthetic.json'});expect(await readFile(path,'utf8')).toBe(json);
});
it('returns cancellation and sanitized dialog errors without file paths',async()=>{
 const frame={},wc={mainFrame:frame,getURL:()=> 'file:///test'},event={sender:wc,senderFrame:frame};
 expect(await createNewsletterSaveHandler(wc,'file:///test',{pick:async()=>undefined,confirm:async()=>true})(event,{json})).toEqual({ok:true,data:{saved:false}});
 const result=await createNewsletterSaveHandler(wc,'file:///test',{pick:async()=>{throw Error('SECRET PATH');},confirm:async()=>true})(event,{json});
 expect(result).toMatchObject({ok:false,error:{code:'STORAGE_ERROR'}});expect(JSON.stringify(result)).not.toContain('SECRET PATH');
});
