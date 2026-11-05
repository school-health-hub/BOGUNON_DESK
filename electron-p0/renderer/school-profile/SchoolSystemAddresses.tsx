import {useEffect,useRef,useState} from 'react';
import {ADMIN_ENVIRONMENTS,type AdminLoad} from '../../admin-protocol';
import {SCHOOL_SYSTEMS,SCHOOL_SESSION_GUIDE,type SchoolAddressPreview,type SchoolSystem} from '../../school-launcher';
import type {SchoolInfo} from '../../school-protocol';
import type {IpcResult} from '../../protocol';
const read=<T,>(result:IpcResult<T>):T=>{if(!result.ok)throw Error(result.error.message);return result.data;};
export function SchoolSystemAddresses({school,revision,onApplied,onBusyChange,blocked=false,onConfigure}:{school:SchoolInfo|null;revision?:number;onApplied?:(load:AdminLoad)=>void;onBusyChange?:(busy:boolean)=>void;blocked?:boolean;onConfigure?:()=>void}){
 const api=window.electronWork.admin,[preview,setPreview]=useState<SchoolAddressPreview|null>(null),[selected,setSelected]=useState<SchoolSystem[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const live=useRef(true),epoch=useRef(0),locked=useRef(false),scope=`${school?.officeCode}/${school?.schoolCode}`;
 const refresh=async()=>{if(!api?.schoolAddresses)return;if(locked.current){setPreview(null);setSelected([]);return;}const ticket=++epoch.current;setPreview(null);setSelected([]);try{const next=read(await api.schoolAddresses());if(live.current&&ticket===epoch.current){setPreview(next);setSelected(next.entries.filter(row=>!row.currentUrl&&row.proposed).map(row=>row.system));setNotice('현재 주소와 초기값을 확인하세요. 기존 주소의 교체 항목은 직접 선택해야 합니다.');}}catch(e){if(live.current&&ticket===epoch.current)setNotice(e instanceof Error?e.message:'주소를 불러오지 못했습니다.');}};
 useEffect(()=>{live.current=true;void refresh();return()=>{live.current=false;epoch.current++;if(locked.current)void api?.cancel();};},[api,scope,revision]);
 const run=async(operation:(current:()=>boolean)=>Promise<void>)=>{if(locked.current||blocked)return;const ticket=epoch.current,current=()=>live.current&&ticket===epoch.current;locked.current=true;setBusy(true);onBusyChange?.(true);try{await operation(current);}catch(e){if(current())setNotice(e instanceof Error?e.message:'주소 작업을 완료하지 못했습니다. 기존 설정을 유지합니다.');}finally{locked.current=false;onBusyChange?.(false);if(live.current){setBusy(false);if(ticket!==epoch.current)void refresh();}}};
 const matches=!!preview?.school&&preview.school.officeCode===school?.officeCode&&preview.school.schoolCode===school?.schoolCode;
 if(!api?.schoolAddresses)return <p>이 실행본에는 학교 초기 주소 확인·적용 연결이 없습니다. 기존 주소 설정을 사용하세요.</p>;
 return <section className="school-address-review" aria-label="학교 업무 주소 확인·적용" aria-busy={busy}>
  <h3>적용된 업무 시스템 주소</h3><p>{preview?`${ADMIN_ENVIRONMENTS[preview.environment]} 주소 환경`:'주소를 확인하는 중입니다.'} · 초기값은 기관별 주소이며, 공용 로그인·인증 주소로 대체하지 않습니다.</p>
  <p>등록은 공식 최신성·학교망 접속 성공을 보증하지 않습니다. 특히 강원 주소는 기관 안내와 대조하세요. 미등록 K-에듀파인은 임의 생성하지 않습니다.</p>
  <button type="button" disabled={busy} onClick={()=>void refresh()}>학교 업무 주소 다시 확인</button>
  {blocked&&<p>진행 중인 작업 또는 저장하지 않은 주소·양식이 있습니다. 기존 입력을 저장하거나 확인한 뒤 주소 적용·열기를 진행하세요.</p>}
  {preview?.readonly&&<p role="alert">복구 자료는 읽기 전용입니다. 기존 학교·주소 파일을 덮어쓰지 않습니다.</p>}
  {preview&&<ul>{preview.entries.map(row=><li key={row.system}><strong>{SCHOOL_SYSTEMS[row.system]}</strong>{row.system==='evpn'&&<p>eVPN 접속 페이지 주소는 두 환경에서 공통으로 사용합니다. 환경별 업무 시스템 주소와 별도입니다.</p>}<p>현재 주소: {row.currentUrl||'미등록'}</p><p>초기값: {row.proposed?.url??'등록된 초기값 없음 · 기관 안내에서 확인 후 직접 등록'}</p>
   {row.proposed&&<p>{row.proposed.verification==='official-source-reviewed'?'기존 공식 출처 대조 기록 · 실시간 최신성 미확인':'공식 확인 필요 · 초기 등록값'}<br/>근거: {row.proposed.evidence}</p>}
   <label><input type="checkbox" disabled={busy||blocked||preview.readonly||!matches||!row.proposed||!api.applySchoolAddresses} checked={selected.includes(row.system)} onChange={event=>setSelected(items=>event.target.checked?[...items,row.system]:items.filter(item=>item!==row.system))}/>{SCHOOL_SYSTEMS[row.system]} 초기 주소 적용 선택</label>
   <button type="button" disabled={busy||blocked||!row.currentUrl} onClick={()=>void run(async current=>{const result=read(await (row.system==='evpn'?api.openEvpn():api.openSystem(row.system)));if(!current())return;setNotice(result.status==='launched'?'기본 브라우저 실행 요청을 완료했습니다. 실제 접속·로그인은 공식 사이트에서 확인하세요.':result.status==='needs-configuration'?'저장 주소가 없습니다. 주소 설정을 확인하세요.':result.status==='blocked'?'허용하지 않는 이동이 차단됐습니다. 기관 안내와 주소를 확인하세요.':'브라우저 열기를 취소했습니다.');if(result.status==='needs-configuration')onConfigure?.();})}>{SCHOOL_SYSTEMS[row.system]} 저장 주소 열기</button>
  </li>)}</ul>}
  <button type="button" disabled={busy||blocked||!matches||preview?.readonly||!selected.length||!api.applySchoolAddresses} onClick={()=>void run(async current=>{
   if(!preview?.school||!api.applySchoolAddresses)return;
   const result=read(await api.applySchoolAddresses({officeCode:preview.school.officeCode,schoolCode:preview.school.schoolCode,expectedRevision:preview.revision,environment:preview.environment,systems:selected}));
   if(!current())return;if(!result){setNotice('주소 적용을 취소했습니다. 학교와 기존 주소는 유지됩니다.');return;}
   onApplied?.(result);setPreview({...preview,revision:result.document.revision,entries:preview.entries.map(row=>({...row,currentUrl:row.system==='evpn'?result.document.launcher?.entryUrl??'':(preview.environment==='school'?result.document.systems:result.document.launcher!.evpn)[row.system]}))});setSelected([]);setNotice('선택한 주소 저장을 완료했습니다. 학교·다른 환경·복무 초안·Excel 데이터는 유지했습니다.');
  })}>선택한 초기 주소 확인 후 적용</button>
  {onConfigure?<button type="button" disabled={busy} onClick={onConfigure}>주소 직접 수정·환경 전환</button>:<p>주소 직접 수정·학교망/eVPN 전환은 업무 도구 → 학교 행정 업무 도우미의 기존 주소 설정에서 진행하세요.</p>}
  <p role="status">{notice}</p><p>{SCHOOL_SESSION_GUIDE}</p>
 </section>;
}
