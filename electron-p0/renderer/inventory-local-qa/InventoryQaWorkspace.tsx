import {useEffect,useRef,useState} from 'react';
import type {AuthState,Item,ItemDetail,Movement,NewItem,RpcInputs} from '../../main/inventory-connection/contracts';
import type {InventoryQaApi,InventoryQaResult,QaHandle} from '../../inventory-qa-protocol';
type Operation='inventory_receive_stock'|'inventory_use_stock'|'inventory_dispose_stock'|'inventory_adjust_stock';
const operationNames:Record<Operation,string>={inventory_receive_stock:'입고',inventory_use_stock:'사용',inventory_dispose_stock:'폐기',inventory_adjust_stock:'정정'};
class UiError extends Error{constructor(readonly result:Extract<InventoryQaResult<unknown>,{ok:false}>['error']){super(result.message);}}
export function InventoryQaWorkspace({api}:{api:InventoryQaApi}){
 const [auth,setAuth]=useState<AuthState>({status:'signed_out'}),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[school,setSchool]=useState('');
 const [items,setItems]=useState<Item[]>([]),[detail,setDetail]=useState<ItemDetail|null>(null),[movements,setMovements]=useState<Movement[]>([]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('합성 example.invalid 계정만 사용하세요.'),[unknown,setUnknown]=useState(false),[handle,setHandle]=useState<QaHandle|null>(null);
 const [operation,setOperation]=useState<Operation>('inventory_use_stock'),[quantity,setQuantity]=useState(''),[reason,setReason]=useState(''),[lot,setLot]=useState(''),[expires,setExpires]=useState('');
 const [register,setRegister]=useState(false),[itemName,setItemName]=useState(''),[baseUnit,setBaseUnit]=useState(''),[purchaseUnit,setPurchaseUnit]=useState(''),[conversion,setConversion]=useState('1');
 const revision=useRef(0),generation=useRef(0),live=useRef(true),working=useRef(false);
 const clear=()=>{setItems([]);setDetail(null);setMovements([]);setHandle(null);setUnknown(false);setLot('');setQuantity('');setReason('');setExpires('');setRegister(false);setItemName('');setBaseUnit('');setPurchaseUnit('');setConversion('1');};
 useEffect(()=>{live.current=true;return()=>{live.current=false;generation.current++;void api.dispose().catch(()=>{});};},[api]);
 const unwrap=async<T,>(response:Promise<InventoryQaResult<T>>,epoch=generation.current):Promise<T>=>{
  const result=await response;if(!live.current||epoch!==generation.current)throw Error('STALE_VIEW');
  revision.current=result.ok?result.data.contextRevision:result.error.contextRevision;
  if(!result.ok)throw new UiError(result.error);return result.data.value;
 };
 const run=async(work:()=>Promise<void>)=>{if(working.current)return;working.current=true;setBusy(true);const epoch=generation.current;try{await work();}catch(e){if(live.current&&epoch===generation.current){
  if(e instanceof UiError){setMessage(e.message);if(e.result.outcomeUnknown)setUnknown(true);if(['UNAUTHENTICATED','STALE_CONTEXT','ENVIRONMENT_BLOCKED','DISPOSED'].includes(e.result.code)){clear();setAuth({status:'signed_out'});}}
  else setMessage('Local QA 요청을 완료하지 못했습니다. 현재 학교와 연결을 확인해 주세요.');
 }}finally{if(live.current){working.current=false;setBusy(false);}}};
 const ctx=()=>({contextRevision:revision.current});
 const refresh=async(itemId?:string)=>{const rows=await unwrap(api.listItems(ctx()));setItems(rows);if(itemId){const next=await unwrap(api.itemDetail({...ctx(),itemId}));setDetail(next);setLot('');}};
 const signed=auth.status==='authenticated';const selectedSchool=signed?auth.schoolId:null;
 useEffect(()=>{
  if(!signed)return;const timer=setInterval(()=>{if(working.current)return;void run(async()=>{const before=revision.current,next=await unwrap(api.authState());setAuth(next);if(before!==revision.current)clear();});},10000);return()=>clearInterval(timer);
 // Poll only the in-memory Main auth state; no token/refresh endpoint in renderer.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[signed,api]);
 const prepare=async()=>{
  if(!detail)return;const itemId=detail.item.item_id;let input:RpcInputs[Operation];
  if(operation==='inventory_use_stock')input={p_item_id:itemId,p_quantity:quantity,p_reason:reason};
  else if(operation==='inventory_receive_stock')input={p_item_id:itemId,p_purchase_quantity:quantity,p_base_units_per_purchase_unit:detail.item.base_units_per_purchase_unit,p_received_at:new Date().toISOString(),p_expires_on:expires||null,p_purchase_link_id:null,p_reason:reason};
  else if(operation==='inventory_dispose_stock')input={p_item_id:itemId,p_lot_id:lot,p_quantity:quantity,p_reason:reason};
  else {const selected=detail.lots.find(row=>row.lot_id===lot);if(!selected)throw Error('LOT_REQUIRED');input={p_item_id:itemId,p_lot_id:lot,p_expected_quantity:selected.remaining_quantity,p_counted_quantity:quantity,p_reason:reason};}
  const prepared=await unwrap(api.prepare({...ctx(),operation,input}));setHandle(prepared);setMessage('서버에는 아직 변경하지 않았습니다. 요청 내용을 확인한 후 실행하세요.');
 };
 const execute=async()=>{if(!handle||!detail)return;const saved=await unwrap(api.execute({...ctx(),handleId:handle.handleId}));if(!saved.persisted)throw Error('NO_PERSISTENCE');setUnknown(false);setDetail(null);setItems([]);setMovements([]);setMessage('서버 변경이 확인되었습니다. 권위 데이터를 다시 조회합니다.');
  try{await refresh(saved.data&&'item_id' in saved.data?saved.data.item_id:undefined);setMessage('서버 변경 및 재조회 완료. 같은 요청 재확인은 동일 UUID를 사용합니다.');}
  catch{setMessage('서버 변경은 확인됐지만 재조회에 실패했습니다. 새 변경을 보내지 말고 다시 조회하세요.');}
 };
 return <section className="inventory-qa-workspace" aria-label="Local QA 업무">
  <p>개발 전용 실제 Local QA · UUID/문자열 수량 모델 · 기존 JSON·Preview와 별도입니다.</p>
  <p role="status">{message}</p>
  {!signed?<form onSubmit={e=>{e.preventDefault();const entered=password;setPassword('');setSchool('');generation.current++;clear();void run(async()=>{setAuth(await unwrap(api.login({email,password:entered})));setMessage('합성 계정 로그인 확인. 학교 멤버십을 확인해 주세요.');});}}>
   <label>합성 계정 이메일<input aria-label="합성 계정 이메일" value={email} type="email" autoComplete="off" disabled={busy} required onChange={e=>setEmail(e.target.value)}/></label>
   <label>합성 계정 비밀번호<input aria-label="합성 계정 비밀번호" value={password} type="password" autoComplete="off" maxLength={4096} disabled={busy} required onChange={e=>setPassword(e.target.value)}/></label><button disabled={busy}>로그인</button>
  </form>:<>
   <p>인증 확인 · {auth.userId} · 학교 {selectedSchool??'미선택'}</p>
   <button type="button" disabled={busy} onClick={()=>{generation.current++;clear();setSchool('');setEmail('');setAuth({status:'signed_out'});void run(async()=>{await unwrap(api.logout());setMessage('로그아웃했습니다.');});}}>로그아웃</button>
   <form onSubmit={e=>{e.preventDefault();generation.current++;clear();setAuth({...auth,schoolId:null});void run(async()=>{setAuth(await unwrap(api.selectSchool({...ctx(),schoolId:school})));await refresh();setMessage('학교 멤버십과 실제 품목 목록을 확인했습니다.');});}}><label>학교 UUID<input aria-label="학교 UUID" value={school} disabled={busy} required onChange={e=>setSchool(e.target.value)}/></label><button disabled={busy}>학교 선택·전환</button></form>
   {selectedSchool&&<>
    <button type="button" disabled={busy} onClick={()=>void run(async()=>{clear();await refresh();setMessage('서버 품목 목록을 다시 조회했습니다.');})}>서버 재조회</button>
    <button type="button" disabled={busy||!!handle} onClick={()=>setRegister(!register)}>품목 등록</button>
    {register&&<form onSubmit={e=>{e.preventDefault();const item:NewItem={item_name:itemName,category:null,specification:null,base_unit:baseUnit,purchase_unit:purchaseUnit,base_units_per_purchase_unit:conversion,recommended_stock:'0',minimum_stock:'0',is_active:true};void run(async()=>{const saved=await unwrap(api.registerItem({...ctx(),item}));setItems([]);setDetail(null);setRegister(false);setMessage('품목 등록이 서버에서 확인되었습니다.');try{await refresh(saved.item.item_id);}catch{setMessage('등록은 확인됐지만 재조회 실패. 다시 조회하세요.');}});}}>
     <label>물품명<input aria-label="QA 물품명" required value={itemName} disabled={busy} onChange={e=>setItemName(e.target.value)}/></label><label>기본 단위<input aria-label="QA 기본 단위" required value={baseUnit} disabled={busy} onChange={e=>setBaseUnit(e.target.value)}/></label><label>구매 단위<input aria-label="QA 구매 단위" required value={purchaseUnit} disabled={busy} onChange={e=>setPurchaseUnit(e.target.value)}/></label><label>포장 변환비<input aria-label="QA 포장 변환비" inputMode="decimal" required value={conversion} disabled={busy} onChange={e=>setConversion(e.target.value)}/></label><button disabled={busy}>검토한 품목 등록 요청</button>
    </form>}
    <div className="inventory-qa-table"><table><caption>실제 Local QA 품목 목록</caption><thead><tr><th>물품명</th><th>분류</th><th>기본 단위</th><th>상세</th></tr></thead><tbody>{items.map(item=><tr key={item.item_id}><td>{item.item_name}</td><td>{item.category??'—'}</td><td>{item.base_unit}</td><td><button disabled={busy||!!handle} onClick={()=>void run(async()=>{setDetail(null);setMovements([]);setDetail(await unwrap(api.itemDetail({...ctx(),itemId:item.item_id})));})}>상세 {item.item_name}</button></td></tr>)}</tbody></table>{items.length===0&&<p>표시할 목록이 없습니다. 학교 선택·조회 상태를 확인하세요.</p>}</div>
    {detail&&<section aria-label="Local QA 품목 상세"><h3>{detail.item.item_name}</h3><p>총재고 {detail.totals.totalQuantity} · 사용 가능 {detail.totals.availableQuantity} · 기준 {detail.totals.referenceDate}</p>
     <ul>{detail.lots.map(row=><li key={row.lot_id}>{row.lot_id} · 잔량 {row.remaining_quantity} · 유효기간 {row.expires_on??'없음'} · {row.status}</li>)}</ul>
     <button disabled={busy} onClick={()=>void run(async()=>setMovements(await unwrap(api.movements({...ctx(),itemId:detail.item.item_id}))))}>이동 이력 조회</button><ul>{movements.map(row=><li key={row.movement_id}>{row.movement_type} · {row.quantity_delta} · {row.created_at}</li>)}</ul>
     <form onSubmit={e=>{e.preventDefault();void run(prepare);}}><fieldset disabled={busy||!!handle}><legend>재고 변경 검토</legend>
      <label>작업<select aria-label="QA 작업" value={operation} onChange={e=>setOperation(e.target.value as Operation)}>{Object.entries(operationNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      {(operation==='inventory_dispose_stock'||operation==='inventory_adjust_stock')&&<label>로트<select aria-label="QA 로트" value={lot} required onChange={e=>setLot(e.target.value)}><option value="">로트 선택</option>{detail.lots.map(row=><option key={row.lot_id} value={row.lot_id}>{row.lot_id} · {row.remaining_quantity}</option>)}</select></label>}
      <label>{operation==='inventory_adjust_stock'?'실사 수량':'수량'}<input aria-label="QA 수량" inputMode="numeric" pattern="[0-9]+" value={quantity} required onChange={e=>setQuantity(e.target.value)}/></label>
      {operation==='inventory_receive_stock'&&<label>유효기간<input aria-label="QA 유효기간" type="date" value={expires} onChange={e=>setExpires(e.target.value)}/></label>}
      <label>합성 사유<input aria-label="QA 사유" value={reason} maxLength={500} required onChange={e=>setReason(e.target.value)}/></label><button>변경 요청 준비</button>
     </fieldset></form>
    </section>}
    {handle&&<section role="group" aria-label="준비된 서버 요청"><p>요청 UUID {handle.requestUuid}</p><p>{operationNames[operation]} · 수량 {quantity} · 서버 실행 전 검토</p>{unknown&&<p role="alert">결과 불명확. 자동 재시도하지 않습니다. 재조회 또는 같은 UUID로 결과를 확인하세요.</p>}
     <button disabled={busy||!detail} onClick={()=>void run(execute)}>동일 UUID로 실행·결과 확인</button><button disabled={busy} onClick={()=>void run(async()=>{await unwrap(api.discard({...ctx(),handleId:handle.handleId}));setHandle(null);setMessage('로컬 준비 상태만 해제했습니다. 서버 변경을 취소하거나 되돌리지 않았습니다.');})}>로컬 준비 해제</button>
    </section>}
   </>}
  </>}
 </section>;
}
