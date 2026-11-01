import {it,expect,vi} from 'vitest';
import {createSampleHandler} from '../main/sample-ipc';
const url='file:///p0/index.html',frame={},wc={mainFrame:frame,getURL:()=>url},event={sender:wc,senderFrame:frame};
const input={fixture:'synthetic-only',completed:['prepare']};
it('uses the feature contract for an authorized synthetic request',()=>{
 expect(createSampleHandler(wc,url)(event,input)).toEqual({ok:true,data:{fixture:'synthetic-only',total:3,completedCount:1,pending:['review','finish']}});
});
it('rejects wrong window, subframe and navigated URL before executing service',()=>{
 const service=vi.fn(),handle=createSampleHandler(wc,url,service);
 for(const caller of [{sender:{},senderFrame:frame},{sender:wc,senderFrame:{}},{sender:wc,senderFrame:null}])expect(handle(caller,input)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 const navigated={...wc,getURL:()=> 'https://evil.invalid'};
 expect(createSampleHandler(navigated,url,service)({sender:navigated,senderFrame:frame},input)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 expect(service).not.toHaveBeenCalled();
});
it('rejects wrong arity, duplicate/unknown tasks, extra fields, paths and oversized lists',()=>{
 const service=vi.fn(),handle=createSampleHandler(wc,url,service);
 for(const args of [[],[input,input],[null],[[]],[{...input,path:'C:/synthetic'}],[{...input,completed:['prepare','prepare']}],[{...input,completed:['unknown']}],[{...input,completed:Array(1)}],[{...input,completed:Array(1000).fill('prepare')}],[{...input,fixture:'real-data'}]])expect(handle(event,...args)).toMatchObject({ok:false,error:{code:'INVALID_INPUT',retryable:false}});
 expect(service).not.toHaveBeenCalled();
});
it('contains internal exceptions without exposing payload, paths or stack',()=>{
 const handle=createSampleHandler(wc,url,()=>{throw Error('SYNTHETIC_SECRET C:/private/data');});
 const result=handle(event,input);
 expect(result).toEqual({ok:false,error:{code:'INTERNAL_ERROR',message:'샘플 처리를 완료하지 못했습니다.',retryable:true}});
 expect(JSON.stringify(result)).not.toContain('SYNTHETIC_SECRET');
});
