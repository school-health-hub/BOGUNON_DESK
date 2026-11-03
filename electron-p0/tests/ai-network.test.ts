import {describe,it,expect,vi} from 'vitest';
import {aiJson,AI_ERROR,allowedAiUrl,discoverAiModels,generateAiText,type AiFetch} from '../main/ai-network';
const response=(data:unknown,init:ResponseInit={})=>new Response(JSON.stringify(data),{...init,headers:{'content-type':'application/json',...init.headers}});
const signal=()=>new AbortController().signal;
describe('Electron AI provider contract reuse',()=>{
 it.each(['http://api.openai.com/v1/models','https://api.openai.com.evil.test/v1/models','https://api.openai.com/v1/models?api_key=x','https://api.openai.com:444/v1/models','https://user@api.openai.com/v1/models','file:///secret','http://127.0.0.1:54321','https://generativelanguage.googleapis.com/v1beta/models/../:generateContent','https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=secret'])('denies non-contract endpoint %s',url=>expect(allowedAiUrl(url)).toBe(false));
 it('discovers only text candidates from account data, never trusts the obsolete static model list',async()=>{
  const fetch=vi.fn<AiFetch>(async()=>response({data:[{id:'gpt-account-text'},{id:'text-embedding-test'},{id:'gpt-account-image'},{id:'gpt-account-text'}]}));
  expect(await discoverAiModels(fetch,'openai','synthetic-key',signal())).toEqual([{id:'gpt-account-text',label:'gpt-account-text'}]);expect(fetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/models');expect(fetch.mock.calls[0][1]).toMatchObject({method:'GET',redirect:'error',credentials:'omit',headers:{Authorization:'Bearer synthetic-key'}});
 });
 it('discovers Gemini generateContent models with bounded pagination',async()=>{
  const fetch=vi.fn<AiFetch>().mockResolvedValueOnce(response({models:[{name:'models/gemini-text',displayName:'합성 텍스트',supportedGenerationMethods:['generateContent']},{name:'models/embedding',supportedGenerationMethods:['embedContent']}],nextPageToken:'synthetic-page'})).mockResolvedValueOnce(response({models:[{name:'models/gemini-second',supportedGenerationMethods:['generateContent']}]}));
  expect((await discoverAiModels(fetch,'gemini','synthetic-key',signal())).map(m=>m.id)).toEqual(['gemini-text','gemini-second']);expect(fetch.mock.calls[1][0]).toContain('&pageToken=synthetic-page');expect(fetch.mock.calls[0][1].headers).toMatchObject({'x-goog-api-key':'synthetic-key'});
 });
 it('preserves Responses input and Gemini contents/text extraction without automatic retry',async()=>{
  const openai=vi.fn<AiFetch>(async()=>response({status:'completed',output:[{type:'reasoning'},{content:[{type:'output_text',text:'합성 응답'}]}]}));
  expect(await generateAiText(openai,'openai','synthetic-key','gpt-account-text','합성 원고',signal())).toBe('합성 응답');expect(JSON.parse(openai.mock.calls[0][1].body as string)).toEqual({model:'gpt-account-text',input:'합성 원고'});expect(openai).toHaveBeenCalledTimes(1);
  const gemini=vi.fn<AiFetch>(async()=>response({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'hidden'},{text:'합성 본문'}]}}]}));
  expect(await generateAiText(gemini,'gemini','synthetic-key','gemini-text','합성 원고',signal())).toBe('합성 본문');expect(JSON.parse(gemini.mock.calls[0][1].body as string)).toEqual({contents:[{parts:[{text:'합성 원고'}]}],generationConfig:{temperature:0.2}});
 });
 it.each([[401,AI_ERROR.auth],[403,AI_ERROR.auth],[429,AI_ERROR.limit],[500,AI_ERROR.connection]] as const)('normalizes HTTP %s without returning error bodies/secrets',async(status,message)=>{
  await expect(aiJson(async()=>response({error:'synthetic-key private prompt'},{status}),'https://api.openai.com/v1/models','openai','synthetic-key',signal())).rejects.toThrow(message);
 });
 it('rejects oversized, malformed, wrong content-type, redirected and incomplete responses',async()=>{
  for(const invalid of [new Response('x'.repeat(1048577),{headers:{'content-type':'application/json'}}),new Response('broken',{headers:{'content-type':'application/json'}}),new Response('{}'),new Response('{}',{headers:{'content-type':'application/json','content-length':'1048577'}})])await expect(aiJson(async()=>invalid,'https://api.openai.com/v1/models','openai','synthetic-key',signal())).rejects.toThrow();
  const redirected=response({});Object.defineProperty(redirected,'redirected',{value:true});await expect(aiJson(async()=>redirected,'https://api.openai.com/v1/models','openai','synthetic-key',signal())).rejects.toThrow();
  await expect(generateAiText(async()=>response({status:'incomplete',output:[{content:[{type:'output_text',text:'partial'}]}]}),'openai','synthetic-key','gpt-account-text','합성',signal())).rejects.toThrow();
  await expect(generateAiText(async()=>response({candidates:[{finishReason:'SAFETY',content:{parts:[{text:'partial'}]}}]}),'gemini','synthetic-key','gemini-text','합성',signal())).rejects.toThrow();
 });
 it('cancels an oversized streaming body and rejects infinite pagination',async()=>{
  const cancel=vi.fn();const stream=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(600000));},cancel});
  await expect(aiJson(async()=>new Response(stream,{headers:{'content-type':'application/json'}}),'https://api.openai.com/v1/models','openai','synthetic-key',signal())).rejects.toThrow();expect(cancel).toHaveBeenCalledTimes(1);
  const fetch=vi.fn<AiFetch>(async()=>response({models:[],nextPageToken:'same'}));await expect(discoverAiModels(fetch,'gemini','synthetic-key',signal())).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(2);
 });
});
