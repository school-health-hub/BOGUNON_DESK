import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {SchoolSystemAddresses} from './SchoolSystemAddresses';
import type {AdminLoad} from '../../admin-protocol';
import {EDUCATION_OFFICES,type SchoolLoad,type SchoolSearch,type SchoolSelection,type OfficeCode} from '../../school-protocol';
import type {IpcResult} from '../../protocol';
import {SurfaceDialog} from '../SurfaceDialog';
import './school-profile.css';
function read<T>(result:IpcResult<T>):T{if(!result.ok)throw Error(result.error.message);return result.data;}
type ProfileContext={data:SchoolLoad|null;loading:boolean;error:string;refresh:()=>Promise<void>;selected:(selection:SchoolSelection)=>Promise<void>};
const Context=createContext<ProfileContext|null>(null);
export function SchoolProfileProvider({children}:{children:ReactNode}){
 const api=window.electronWork.school,[data,setData]=useState<SchoolLoad|null>(null),[loading,setLoading]=useState(!!api),[error,setError]=useState('');const mounted=useRef(true),generation=useRef(0);
 const refresh=async()=>{if(!api)return;const token=++generation.current;setLoading(true);try{const result=read(await api.load());if(mounted.current&&token===generation.current){setData(result);setError('');}}catch(e){if(mounted.current&&token===generation.current)setError(e instanceof Error?e.message:'학교 설정을 불러오지 못했습니다.');}finally{if(mounted.current&&token===generation.current)setLoading(false);}};
 useEffect(()=>{mounted.current=true;void refresh();return()=>{mounted.current=false;generation.current++;void api?.cancel();};},[api]);
 const selected=async(input:SchoolSelection)=>{if(!api)throw Error('학교 연결이 없습니다.');const result=read(await api.select(input));if(mounted.current){generation.current++;setLoading(false);setData(result);setError('');}};
 return <Context.Provider value={{data,loading,error,refresh,selected}}>{children}</Context.Provider>;
}
export function SchoolInitialSetup(){
 const state=useContext(Context),[dismissed,setDismissed]=useState(false),[started,setStarted]=useState(false);
 useEffect(()=>{if(state?.data&&!state.loading&&!state.error&&!state.data.document.school)setStarted(true);},[state?.data,state?.loading,state?.error]);
 if(!state?.data||state.loading||state.error||state.data.document.school&&!started||dismissed)return null;
 return <SurfaceDialog title="학교 초기 설정" onClose={()=>setDismissed(true)}><SchoolProfileSettings/><button type="button" onClick={()=>setDismissed(true)}>{state.data.document.school?'학교 설정 마치기':'나중에 설정'}</button><p>학교를 선택하지 않아도 기존 로컬 작업을 계속할 수 있습니다.</p></SurfaceDialog>;
}
export function SchoolProfileSettings({showAddresses=true}:{showAddresses?:boolean}={}){
 const state=useContext(Context),api=window.electronWork.school;
 const [name,setName]=useState(''),[office,setOffice]=useState<OfficeCode|''>(''),[search,setSearch]=useState<SchoolSearch|null>(null),[busy,setBusy]=useState(false),[searching,setSearching]=useState(false),[notice,setNotice]=useState('');const mounted=useRef(true),epoch=useRef(0),running=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;void api?.cancel();};},[api]);
 if(!state||!api)return <p>이 실행본에는 공통 학교 프로필 연결이 없습니다.</p>;
 const current=state.data?.document.school;
 const run=async(operation:(token:number)=>Promise<void>)=>{if(running.current)return;running.current=true;setBusy(true);const token=++epoch.current;try{await operation(token);}catch(e){if(mounted.current&&token===epoch.current)setNotice(e instanceof Error?e.message:'학교 설정에 실패했습니다.');}finally{running.current=false;if(mounted.current){setBusy(false);setSearching(false);}}};
 const clearSearch=()=>{epoch.current++;setSearch(null);void api.cancel();};
 return <section className="school-profile" aria-label="공통 학교 프로필" aria-busy={busy||state.loading}>
  <h2>학교 선택</h2><p>이 Electron 프로필에서 학교명·학교코드·시도교육청코드를 한 번 저장해 행정 런처에서 재사용합니다.</p>
  <p className="school-profile-status">BOGUNON 계정 연결: 현재 Electron에서 미지원. 기존 Tauri 계정·등록 학교를 자동으로 읽거나 가져오지 않습니다. NEIS 공개 조회에서 학교를 선택해 주세요.</p>
  {current?<p><strong>현재 학교: {current.schoolName}</strong><br/>{current.officeName} · 교육청 {current.officeCode} · 학교 {current.schoolCode}</p>:<p>아직 학교를 선택하지 않았습니다.</p>}
  {showAddresses&&<SchoolSystemAddresses school={current??null} blocked={!!state.data?.recovered||busy||state.loading}/>}
  {state.error&&<p role="alert">{state.error}</p>}{state.data?.recovered&&<p role="alert">학교 프로필 백업을 읽었습니다. 원본 보호를 위해 변경을 차단합니다.</p>}
  <button type="button" disabled={busy||state.loading} onClick={()=>void state.refresh()}>학교 정보 다시 불러오기</button>
  <form onSubmit={event=>{event.preventDefault();void run(async token=>{setSearching(true);setSearch(null);setNotice('NEIS에 학교 이름만 전송해 조회하는 중…');const result=read(await api.search({name:name.trim(),officeCode:office}));if(!mounted.current||token!==epoch.current)return;setSearch(result);setNotice(result.results.length?'결과를 확인하고 학교 선택 버튼을 눌러 주세요. 검색만으로 학교를 변경하지 않습니다.':'조회 결과가 없습니다. 교육청과 학교 이름을 확인해 주세요.');});}}>
   <div className="school-profile-fields"><label>시도교육청<select value={office} disabled={busy} onChange={e=>{clearSearch();setOffice(e.target.value as OfficeCode|'');}}><option value="">전체 교육청</option>{Object.entries(EDUCATION_OFFICES).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label>
   <label>학교명<input value={name} minLength={2} maxLength={60} disabled={busy} placeholder="학교 이름만 입력" onChange={e=>{clearSearch();setName(e.target.value);}}/></label></div>
   <p>NEIS 교육정보 개방 API · 인증키 없는 공개 조회(최대 5건)입니다. 학교·교육청·소재지를 확인하세요. 학생·교직원 정보는 입력하지 마세요.</p>
   <button type="submit" disabled={busy||name.trim().length<2}>NEIS 학교 검색</button>{searching&&<button type="button" onClick={()=>{epoch.current++;void api.cancel();setSearch(null);setNotice('학교 검색 취소를 요청했습니다. 기존 학교는 유지됩니다.');}}>학교 검색 취소</button>}
  </form>
  <p role="status">{notice}</p>
  {search&&<ul className="school-profile-results">{search.results.map(candidate=><li key={candidate.school.officeCode+candidate.school.schoolCode}><div><strong>{candidate.school.schoolName}</strong><p>{candidate.school.officeName} · {candidate.kind} · {candidate.location}<br/>교육청 {candidate.school.officeCode} · 학교 {candidate.school.schoolCode}</p></div><button type="button" disabled={busy||!state.data||state.data.recovered||state.loading} onClick={()=>void run(async()=>{if(!state.data||!window.confirm(`${candidate.school.schoolName}을 공통 학교로 저장할까요? 기존 시스템 주소·복무 초안·Excel·다른 로컬 데이터는 변경하지 않습니다. 주소가 새 학교에 맞는지 직접 확인해 주세요.`))return;await state.selected({searchId:search.searchId,officeCode:candidate.school.officeCode,schoolCode:candidate.school.schoolCode,expectedRevision:state.data.document.revision});if(mounted.current){setSearch(null);setNotice('학교 프로필을 저장했습니다. 기존 주소·초안·업무 데이터는 유지했습니다.');}})}>학교 선택 · {candidate.school.schoolName}</button></li>)}</ul>}
 </section>;
}
export function SchoolLauncherProfile({onConfigure,onApplied,onBusyChange,blocked=false,revision}:{onConfigure:()=>void;onApplied?:(load:AdminLoad)=>void;onBusyChange?:(busy:boolean)=>void;blocked?:boolean;revision?:number}){
 const state=useContext(Context);if(!state)return null;const school=state.data?.document.school;
 return <section className="school-profile school-launcher-profile" aria-label="행정 런처 학교 프로필"><h2>공통 학교</h2>{school?<><strong>{school.schoolName}</strong><p>{school.officeName} · {school.officeCode} / {school.schoolCode}</p><p>학교 변경만으로 기존 주소를 변경하지 않습니다. 아래 현재 주소와 초기값을 확인하고 적용할 항목을 직접 선택하세요.</p></>:<p>학교를 아직 선택하지 않았습니다. 기존 등록 주소는 계속 사용할 수 있습니다.</p>}{state.error&&<p role="alert">{state.error}</p>}
 <SchoolSystemAddresses school={school??null} revision={revision} onApplied={onApplied} onBusyChange={onBusyChange} blocked={blocked||!!state.data?.recovered||state.loading} onConfigure={onConfigure}/>
 <button type="button" onClick={onConfigure}>현재 환경 주소 설정</button><details><summary>학교 선택·변경</summary><SchoolProfileSettings showAddresses={false}/></details></section>;
}
