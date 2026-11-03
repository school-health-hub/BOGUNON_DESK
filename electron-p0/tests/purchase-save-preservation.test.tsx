// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,within} from '@testing-library/react';
import {PurchaseSession} from '../renderer/purchase/PurchaseSession';
import {validateSpecialOutput} from '../main/purchase-specialized-validation';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
function edit(label:string,value:string){const el=screen.getByLabelText(label);fireEvent.focus(el);fireEvent.change(el,{target:{value}});fireEvent.keyDown(el,{key:'Enter'});fireEvent.blur(el);}
for(const kind of ['settlement','edufine'] as const)it(`${kind}: cancelled/failed saves preserve items and settlement, allowing retry without recalculation changes`,async()=>{
 const requests:unknown[]=[];
 const output=vi.fn().mockImplementation(async (request:unknown)=>{validateSpecialOutput(request,kind);requests.push(structuredClone(request));return requests.length===1?{ok:true,data:{status:'canceled'}}:requests.length===2?{ok:false,error:{code:'STORAGE_ERROR',message:'합성 저장 실패 — 원본 보존',retryable:true}}:{ok:true,data:{status:'saved',fileName:'synthetic.xlsx'}};});
 vi.stubGlobal('electronWork',{purchase:{cancelCsv:async()=>({ok:true,data:null}),previewSettlement:async()=>({ok:true,data:{headers:['품목'],rows:[['합성 품목']],summaryRows:[]}}),previewEdufine:async()=>({ok:true,data:{headers:['내용','규격','수량','예상단가'],rows:[['합성 품목','',2,12000]]}}),exportSettlement:output,exportEdufine:output}});
 render(<PurchaseSession open onClose={vi.fn()}/>);fireEvent.click(screen.getByRole('button',{name:'품목 추가'}));edit('1행 품명','합성 품목');edit('1행 수량','2');edit('1행 단가','12000');
 if(kind==='settlement'){fireEvent.click(screen.getByRole('tab',{name:'구매결과'}));fireEvent.change(screen.getByLabelText('1행 실제 수량'),{target:{value:'1.5'}});fireEvent.change(screen.getByLabelText('배송비'),{target:{value:'3000'}});fireEvent.change(screen.getByLabelText('할인 금액'),{target:{value:'1000'}});fireEvent.change(screen.getByLabelText('정산 미리보기 출력 형식'),{target:{value:'settlement-xlsx'}});}
 const open=()=>fireEvent.click(screen.getByRole('button',{name:kind==='settlement'?'정산 출력 미리보기':'에듀파인용 Excel'}));
 for(let attempt=0;attempt<3;attempt++){
  open();const modal=await screen.findByRole('dialog',{name:kind==='settlement'?'구매결과 XLSX 미리보기':'에듀파인 XLSX 미리보기'});fireEvent.click(within(modal).getByRole('button',{name:'확인한 내용으로 출력'}));
  await screen.findByText(attempt===0?(kind==='settlement'?'구매결과 저장을 취소했습니다.':'에듀파인 저장을 취소했습니다.'):attempt===1?'합성 저장 실패 — 원본 보존':kind==='settlement'?'구매결과 XLSX 파일을 저장했습니다.':'에듀파인 XLSX를 저장했습니다.');
  if(kind==='settlement'){expect((screen.getByLabelText('1행 실제 수량') as HTMLInputElement).value).toBe('1.5');expect((screen.getByLabelText('배송비') as HTMLInputElement).value).toBe('3000');expect((screen.getByLabelText('할인 금액') as HTMLInputElement).value).toBe('1000');}
  else expect((screen.getByLabelText('1행 품명') as HTMLInputElement).value).toBe('합성 품목');
 }
 expect(output).toHaveBeenCalledTimes(3);expect(requests[1]).toEqual(requests[0]);expect(requests[2]).toEqual(requests[0]);
});
