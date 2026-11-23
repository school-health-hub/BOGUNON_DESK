import {lazy,Suspense,useEffect,useState} from 'react';
import type {FinanceAvailability} from '../../finance-protocol';
import './finance.css';
const FinanceScreen=lazy(()=>import('../../../src/my-finance/FinanceScreen').then(m=>({default:m.FinanceScreen})));
export function FinanceHost({onClose}:{onClose:()=>void}){
 const [availability,setAvailability]=useState<FinanceAvailability|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;const api=window.electronWork?.finance;if(!api){setError('이 실행본에는 암호화 금융 연결이 없습니다.');return;}
  void api.status().then(result=>{if(!active)return;if(result.ok)setAvailability(result.data);else setError(result.error.message);}).catch(()=>{if(active)setError('암호화 금융 엔진을 확인하지 못했습니다.');});
  return()=>{active=false;void api.close();};
 },[]);
 if(error||availability&&!availability.available)return <section className="electron-finance-blocked"><h1>MY FINANCE</h1><p role="alert">{error||availability?.reason}</p><p>이 PC의 보안 저장 기능을 사용할 수 있을 때만 열립니다. 이전 버전 자료는 자동으로 가져오거나 변경하지 않습니다.</p><button type="button" onClick={onClose}>보건 업무로</button></section>;
 if(!availability)return <p role="status">MY FINANCE 암호화 엔진을 확인하는 중…</p>;
 return <div className="electron-finance-host"><p className="electron-finance-isolation">금융 자료는 이 PC에 별도 저장됩니다. 이전 앱의 자료는 자동으로 가져오지 않으며 외부로 전송하지 않습니다.</p><Suspense fallback={<p role="status">MY FINANCE를 불러오는 중…</p>}><FinanceScreen onClose={onClose}/></Suspense></div>;
}
