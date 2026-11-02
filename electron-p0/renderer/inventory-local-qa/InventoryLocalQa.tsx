import {useEffect,useRef,useState} from 'react';
import './local-qa.css';
export function InventoryLocalQa({onClose}:{onClose:()=>void}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('연결 상태를 아직 확인하지 않았습니다.');
 const live=useRef(true),close=useRef<HTMLButtonElement>(null);
 useEffect(()=>{live.current=true;const previous=document.activeElement as HTMLElement|null;close.current?.focus();return()=>{live.current=false;previous?.focus();};},[]);
 if(!import.meta.env.DEV)return null;
 const check=async()=>{
  setBusy(true);
  try{const api=window.electronWork.inventoryLocalQa;if(!api)throw Error();const result=await api.status();if(!live.current)return;
   setMessage(!result.ok?result.error.message:result.data.authGateway==='reachable'?'로컬 Auth 게이트웨이에 응답이 있습니다. DB·인증·RPC는 검증하지 않았습니다.':'로컬 Auth 게이트웨이를 확인하지 못했습니다. 실제 재고 연결은 비활성화 상태입니다.');
  }catch{if(live.current)setMessage('연결 상태를 확인하지 못했습니다.');}finally{if(live.current)setBusy(false);}
 };
 return <section className="inventory-local-qa" aria-label="물품관리 — 로컬 QA" data-mode="local-qa" data-persisted="false">
  <header><h2>물품관리 — 로컬 QA</h2><button ref={close} type="button" onClick={onClose}>로컬 QA 닫기</button></header>
  <p role="note">격리된 개발 점검 전용 · 운영 연결 없음 · 기존 JSON 및 미리보기 데이터 사용 없음</p>
  <p><strong>BLOCKED — 실제 Inventory 연결 대기</strong></p>
  <p>Cloud B Adapter의 Electron transport 계약이 필요합니다. 로그인·학교 선택·조회·입고·사용·폐기·정정은 아직 사용할 수 없습니다. 계정이나 실제 재고를 입력하지 마세요.</p>
  <button type="button" disabled={busy} onClick={()=>void check()}>로컬 Auth 연결 상태 확인</button>
  <p role="status">{message}</p>
 </section>;
}
