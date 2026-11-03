import {it,expect,vi} from 'vitest';
import {AiService,createAiHandlers,validateAiRequest} from '../main/ai-service';
import {AI_ERROR,type AiFetch} from '../main/ai-network';
import type {AiCredential,AiVault} from '../main/ai-vault';
import {readFileSync} from 'node:fs';
import {evaluateOfficialDocumentOutbound} from '../../src/official-document/officialDocumentAiService';
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};};
function setup(options:{available?:boolean;fetch?:AiFetch;timeoutMs?:number}={}){
 let stored:AiCredential|null=null;
 const vault:AiVault={available:options.available??true,exists:vi.fn(async()=>stored!==null),read:vi.fn(async()=>stored),write:vi.fn(async value=>{stored=value;}),clear:vi.fn(async()=>{stored=null;})};
 const fetch=vi.fn<AiFetch>(options.fetch??(async(_url,init)=>init.method==='GET'?json({data:[{id:'gpt-synthetic'},{id:'gpt-second'}]}):json({status:'completed',output:[{content:[{type:'output_text',text:'합성 응답'}]}]})));
 const readClipboard=vi.fn(async()=> 'synthetic-api-key'),clearClipboard=vi.fn(async()=>{}),reviewKey=vi.fn(async()=>true),reviewSend=vi.fn(async()=>true);
 const service=new AiService({vault,fetch,readClipboard,clearClipboard,reviewKey,reviewSend,timeoutMs:options.timeoutMs});
 return {service,vault,fetch,readClipboard,clearClipboard,reviewKey,reviewSend};
}
it('reuses the exact existing privacy rules in Main and preserves outbound limits',()=>{
 expect(readFileSync('electron-p0/main/ai-privacy.ts','utf8').split('\n').slice(1).join('\n')).toBe(readFileSync('src/official-document/privacyGuard.ts','utf8'));
 for(const prompt of ['합성 업무 원고','이름: 홍길동','연락처: 010-1234-5678','진단명: 합성','가'.repeat(22000),'']){
  const evaluation=evaluateOfficialDocumentOutbound(prompt);if(evaluation.canConfirm)expect(validateAiRequest({tool:'official-document',prompt})).toEqual({tool:'official-document',prompt});else expect(()=>validateAiRequest({tool:'official-document',prompt})).toThrow();
 }
});
it('never reads clipboard/fetches on status or denied consent; returns no key to Renderer',async()=>{
 const ctx=setup();await ctx.service.status();expect(ctx.readClipboard).not.toHaveBeenCalled();expect(ctx.fetch).not.toHaveBeenCalled();ctx.reviewKey.mockResolvedValueOnce(false);expect(await ctx.service.connectFromClipboard({provider:'openai',remember:true})).toBeNull();expect(ctx.readClipboard).not.toHaveBeenCalled();
 const state=await ctx.service.connectFromClipboard({provider:'openai',remember:true});expect(state).toMatchObject({connected:true,provider:'openai',model:'gpt-synthetic',stored:true,chatGptSupported:false});expect(JSON.stringify(state)).not.toContain('synthetic-api-key');expect(ctx.clearClipboard).toHaveBeenCalledWith('synthetic-api-key');expect(ctx.vault.write).toHaveBeenCalledTimes(1);
 ctx.reviewSend.mockResolvedValueOnce(false);expect(await ctx.service.generate({tool:'finder',prompt:'합성 안내문'})).toBeNull();expect(ctx.fetch).toHaveBeenCalledTimes(1);
 expect(await ctx.service.generate({tool:'newsletter',prompt:'합성 건강 원고'})).toEqual({text:'합성 응답'});expect(ctx.reviewSend).toHaveBeenLastCalledWith({tool:'newsletter',prompt:'합성 건강 원고'},{provider:'openai',model:'gpt-synthetic'});
 await ctx.service.selectModel({model:'gpt-second'});await expect(ctx.service.selectModel({model:'gpt-unlisted'})).rejects.toThrow('조회한');expect((await ctx.service.status()).model).toBe('gpt-second');
 await ctx.service.disconnect();expect(await ctx.service.status()).toMatchObject({connected:false,stored:false});await expect(ctx.service.generate({tool:'finder',prompt:'합성'})).rejects.toThrow('연결');
});
it('restores encrypted credentials only on explicit request and rejects unsafe storage fallback',async()=>{
 const ctx=setup();await ctx.vault.write({provider:'openai',key:'synthetic-restored-key',model:'gpt-second'});expect(await ctx.service.status()).toMatchObject({stored:true,connected:false});expect(ctx.vault.read).not.toHaveBeenCalled();expect(ctx.fetch).not.toHaveBeenCalled();await ctx.service.restore();expect((await ctx.service.status()).model).toBe('gpt-second');
 const session=setup({available:false});await expect(session.service.connectFromClipboard({provider:'openai',remember:true})).rejects.toThrow('세션');expect(session.readClipboard).not.toHaveBeenCalled();await session.service.connectFromClipboard({provider:'openai',remember:false});expect(session.vault.write).not.toHaveBeenCalled();session.service.dispose();expect((await session.service.status()).connected).toBe(false);
});
it('rejects arbitrary endpoints, keys, invalid models and privacy before any outbound request',async()=>{
 const ctx=setup();for(const input of [{provider:'openai',remember:false,url:'https://evil.test'},{provider:'other',remember:false},{provider:'openai',remember:'yes'}])expect(()=>ctx.service.connectFromClipboard(input)).toThrow();
 for(const input of [{tool:'finder',prompt:'합성',url:'https://evil.test'},{tool:'finder',prompt:'합성',apiKey:'must-not-accept'},{tool:'finance',prompt:'합성'},{tool:'official-document',prompt:'성명: 홍길동'},{tool:'newsletter',prompt:'가'.repeat(22000)}])expect(()=>ctx.service.generate(input)).toThrow();expect(ctx.fetch).not.toHaveBeenCalled();expect(ctx.reviewSend).not.toHaveBeenCalled();
});
it('cancels native review and rejects stale generation output after disconnect',async()=>{
 const ctx=setup(),gate=deferred<boolean>();ctx.reviewKey.mockImplementationOnce(()=>gate.promise);const connecting=ctx.service.connectFromClipboard({provider:'openai',remember:false});const denied=expect(connecting).rejects.toThrow('취소');ctx.service.cancel();gate.resolve(true);await denied;expect(ctx.readClipboard).not.toHaveBeenCalled();
 await ctx.service.connectFromClipboard({provider:'openai',remember:false});const pending=deferred<Response>();ctx.fetch.mockImplementationOnce(()=>pending.promise);const generation=ctx.service.generate({tool:'finder',prompt:'합성'});const rejected=expect(generation).rejects.toThrow('취소');await new Promise(resolve=>setTimeout(resolve,0));await ctx.service.disconnect();pending.resolve(json({status:'completed',output:[{content:[{type:'output_text',text:'late'}]}]}));await rejected;expect((await ctx.service.status()).connected).toBe(false);
});
it('serializes logout behind an in-flight credential save so credentials cannot reappear',async()=>{
 const ctx=setup(),entered=deferred<void>(),release=deferred<void>();const original=ctx.vault.write;vi.mocked(ctx.vault.write).mockImplementationOnce(async credential=>{entered.resolve();await release.promise;await original(credential);});
 const connecting=ctx.service.connectFromClipboard({provider:'openai',remember:true});const rejected=expect(connecting).rejects.toThrow('취소');await entered.promise;const logout=ctx.service.disconnect();release.resolve();await logout;await rejected;expect(await ctx.vault.exists()).toBe(false);expect((await ctx.service.status()).connected).toBe(false);
});
it('times out without automatic replay and keeps a prior valid connection on failed replacement',async()=>{
 const ctx=setup({timeoutMs:10});await ctx.service.connectFromClipboard({provider:'openai',remember:false});ctx.fetch.mockImplementationOnce(async(_url,init)=>new Promise((_resolve,reject)=>init.signal?.addEventListener('abort',()=>reject(Error('aborted')),{once:true})));
 await expect(ctx.service.generate({tool:'finder',prompt:'합성'})).rejects.toThrow(AI_ERROR.timeout);expect(ctx.fetch).toHaveBeenCalledTimes(2);expect((await ctx.service.status()).connected).toBe(true);
 ctx.fetch.mockResolvedValueOnce(new Response('do-not-return-key',{status:401}));await expect(ctx.service.connectFromClipboard({provider:'gemini',remember:false})).rejects.toThrow(AI_ERROR.auth);expect((await ctx.service.status()).provider).toBe('openai');
});
it('checks exact window/frame/URL, arity and sanitizes unexpected errors',async()=>{
 const ctx=setup(),frame={},contents={mainFrame:frame,getURL:()=> 'file:///synthetic/index.html'},handlers=createAiHandlers(contents,contents.getURL(),ctx.service),event={sender:contents,senderFrame:frame};
 expect(await handlers.status({...event,sender:{}})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await handlers.status({...event,senderFrame:{}})).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});expect(await handlers.status(event,'extra')).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 vi.mocked(ctx.vault.exists).mockRejectedValueOnce(Error('synthetic-api-key'));const failed=await handlers.status(event);expect(failed.ok).toBe(false);expect(JSON.stringify(failed)).not.toContain('synthetic-api-key');
 contents.getURL=()=> 'https://evil.test';expect(await handlers.status(event)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
});
it('does not expose echoed credentials from model or text responses',async()=>{
 const ctx=setup();ctx.fetch.mockResolvedValueOnce(json({data:[{id:'gpt-synthetic-api-key'}]}));await expect(ctx.service.connectFromClipboard({provider:'openai',remember:false})).rejects.toThrow(AI_ERROR.invalid);expect((await ctx.service.status()).connected).toBe(false);
 await ctx.service.connectFromClipboard({provider:'openai',remember:false});ctx.fetch.mockResolvedValueOnce(json({status:'completed',output:[{content:[{type:'output_text',text:'synthetic-api-key'}]}]}));await expect(ctx.service.generate({tool:'finder',prompt:'합성'})).rejects.toThrow(AI_ERROR.invalid);
});
