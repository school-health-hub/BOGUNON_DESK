import {WorkspaceLoadingReporter} from '../ui/WorkspaceLoadingReporter';
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import type {FinanceAvailability} from '../../finance-protocol';
import './finance.css';
const FinanceScreen=lazy(()=>import('../../../src/my-finance/FinanceScreen').then(m=>({default:m.FinanceScreen})));
export function FinanceHost({onClose,embedded=false,closeRequest,onCloseRequestResolved}:{onClose:()=>void;embedded?:boolean;closeRequest?:number;onCloseRequestResolved?:(closed:boolean)=>void}){
 const [availability,setAvailability]=useState<FinanceAvailability|null>(null),[error,setError]=useState('');
 const previousCloseRequest=useRef(closeRequest);
 useEffect(()=>{let active=true;const api=window.electronWork?.finance;if(!api){setError('이 실행본에는 암호화 금융 연결이 없습니다.');return;}
  void api.status().then(result=>{if(!active)return;if(result.ok)setAvailability(result.data);else setError(result.error.message);}).catch(()=>{if(active)setError('암호화 금융 엔진을 확인하지 못했습니다.');});
  return()=>{active=false;void api.close();};
 },[]);
 useEffect(()=>{
  if(closeRequest===undefined||previousCloseRequest.current===closeRequest)return;
  previousCloseRequest.current=closeRequest;
  if(availability?.available&&!error)return;
  onClose();onCloseRequestResolved?.(true);
 },[availability,closeRequest,error,onClose,onCloseRequestResolved]);
 if(error||availability&&!availability.available)return <section className="electron-finance-blocked"><h1>MY FINANCE</h1><p role="alert">{error||availability?.reason}</p><p>기존 Tauri 데이터는 읽거나 변경하지 않습니다. SQLCipher·Windows DPAPI를 사용할 수 있을 때만 연결합니다.</p><button type="button" onClick={onClose}>보건 업무로</button></section>;
 if(!availability)return <WorkspaceLoadingReporter><p role="status">MY FINANCE 암호화 엔진을 확인하는 중…</p></WorkspaceLoadingReporter>;
 return <div className={`electron-finance-host${embedded?' is-embedded':''}`}><p className="electron-finance-isolation">Electron 전용 금융 저장소 · 기존 Tauri 금융 데이터 자동 읽기·이전 없음 · 외부 전송 없음</p><Suspense fallback={<WorkspaceLoadingReporter><p role="status">MY FINANCE를 불러오는 중…</p></WorkspaceLoadingReporter>}><FinanceScreen embedded={embedded} closeRequest={closeRequest} onCloseRequestResolved={onCloseRequestResolved} onClose={onClose}/></Suspense></div>;
}
