import {it,expect,vi} from 'vitest';
import {createPurchaseClipboardHandler} from '../main/purchase-clipboard';
const url='file:///p0/index.html',frame={},wc={mainFrame:frame,getURL:()=>url},event={sender:wc,senderFrame:frame};
const input={text:'합성 품목',html:'<p>합성 &lt;품목&gt;</p><table><tbody><tr><td>1</td></tr></tbody></table>'};
it('writes text and safe HTML only after caller and content validation',async()=>{
 const write=vi.fn(),handle=createPurchaseClipboardHandler(wc,url,write);
 expect(await handle(event,input)).toEqual({ok:true,data:null});expect(write).toHaveBeenCalledWith(input);
 for(const e of [{sender:{},senderFrame:frame},{sender:wc,senderFrame:{}},{sender:wc,senderFrame:null}])expect(await handle(e,input)).toMatchObject({ok:false,error:{code:'FORBIDDEN'}});
 expect(write).toHaveBeenCalledTimes(1);
});
it('rejects malformed, oversized, executable and path-bearing payloads',async()=>{
 const write=vi.fn(),handle=createPurchaseClipboardHandler(wc,url,write);
 for(const args of [[],[input,input],[null],[{...input,path:'C:/anything'}],[{...input,text:' '}],[{...input,html:'<img src="file:///x">'}],[{...input,html:'<p onclick="x">x</p>'}],[{...input,html:'<script>x</script>'}],[{...input,text:'x'.repeat(500001)}],[{...input,html:'x'.repeat(1000001)}],[{...input,html:'\0'}]])expect(await handle(event,...args)).toMatchObject({ok:false,error:{code:'INVALID_INPUT'}});
 expect(write).not.toHaveBeenCalled();
});
it('reports a rejected native write without logging the content or reporting success',async()=>{
 expect(await createPurchaseClipboardHandler(wc,url,async()=>{throw Error('synthetic failure');})(event,input)).toMatchObject({ok:false,error:{code:'INTERNAL_ERROR'}});
});
