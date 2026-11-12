import {useEffect,useRef,useState} from 'react';
import type {ChatGptStatus} from '../../chatgpt-protocol';
import type {IpcResult} from '../../protocol';
const labels={disconnected:'미연결',authenticating:'인증 중','permission-required':'권한 확인 필요',ready:'사용 가능','reauthentication-required':'재인증 필요','usage-limit':'한도 도달','temporary-error':'일시 오류'};
const read=<T,>(r:IpcResult<T>)=>{if(!r.ok)throw Error(r.error.message);return r.data;};
export function ChatGptSettings({configurationOnly=false}:{readonly configurationOnly?:boolean}={}){
 const api=window.electronWork?.chatgpt;
 const [state,setState]=useState<ChatGptStatus|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[response,setResponse]=useState('');
 const mounted=useRef(true),owned=useRef(false),epoch=useRef(0);
 useEffect(()=>{mounted.current=true;if(api)void api.status().then(r=>{if(mounted.current)setState(read(r));}).catch(()=>{if(mounted.current)setNotice('ChatGPT 상태를 확인하지 못했습니다.');});return()=>{mounted.current=false;epoch.current++;if(owned.current)void api?.cancel();};},[api]);
 async function run(work:()=>Promise<ChatGptStatus|null>){if(!api||busy)return;const generation=++epoch.current;owned.current=true;setBusy(true);setNotice('');try{const next=await work();if(mounted.current&&generation===epoch.current&&next)setState(next);}catch(e){if(mounted.current&&generation===epoch.current)setNotice(e instanceof Error?e.message:'요청을 완료하지 못했습니다.');}finally{owned.current=false;if(mounted.current&&generation===epoch.current){setBusy(false);void api.status().then(r=>{if(mounted.current&&generation===epoch.current&&r.ok)setState(r.data);});}}}
 if(!api)return <section><h3>ChatGPT 계정 · 이 실행본 미지원</h3><p>ChatGPT 연결 helper가 제공되지 않는 실행본입니다.</p></section>;
 return <section aria-label="ChatGPT 계정 연결"><h3>ChatGPT 계정</h3><p>공식 Sign in with ChatGPT · 기존 Tauri 인증정보를 가져오지 않습니다. API Key 연결과 별도로 관리합니다.</p>
 <p role="status">{state?labels[state.phase]:'상태 확인 중'}{state?.identity?` · ${state.identity}`:''}</p><p>{state?.notice}</p>
 <p>ChatGPT plan/credits 사용은 계정·워크스페이스 권한과 한도에 따릅니다. 로그인·모델 조회 성공은 AI 호출 성공을 의미하지 않습니다.</p>
 <button type="button" disabled={busy||!state?.supported} onClick={()=>{setState(old=>old?{...old,phase:'authenticating'}:old);void run(async()=>read(await api.signIn()));}}>Continue with ChatGPT · 연결·재인증</button>
 <button type="button" disabled={busy||!state?.supported} onClick={()=>void run(async()=>read(await api.refreshModels()))}>ChatGPT 모델 목록 새로고침</button>
 {state?.models.length? <label>ChatGPT 모델<select aria-label="ChatGPT 모델" disabled={busy} value={state.model??''} onChange={e=>void run(async()=>read(await api.selectModel({model:e.target.value})))}>{state.models.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>:null}
 {state?.showPlanNotice&&<div><p>지원되는 요청에 ChatGPT 요금제를 사용합니다. ChatGPT 설정 → 사용량에서 앱 한도와 크레딧 사용을 관리하세요.</p><button type="button" disabled={busy} onClick={()=>void run(async()=>read(await api.acknowledge()))}>요금제 사용 안내 확인</button></div>}
 {!configurationOnly&&<button type="button" disabled={busy||!state?.model||state.phase!=='ready'} onClick={()=>void run(async()=>{const result=read(await api.generate({tool:'connection-test',prompt:'개인정보가 없는 합성 연결 확인입니다. 한국어로 연결 확인이라고만 답해 주세요.'}));if(mounted.current&&result)setResponse(result.text);return null;})}>합성 텍스트 요청 · 전송 전 확인</button>}
 <button type="button" disabled={busy||!state?.supported} onClick={()=>void run(async()=>read(await api.disconnect()))}>ChatGPT 연결 해제</button>
 {busy&&<button type="button" onClick={()=>{void api.cancel();setNotice('취소를 요청했습니다. 이미 전송된 내용은 회수할 수 없습니다.');}}>ChatGPT 요청 취소</button>}
 <p role="status">{state?.textCallVerified?'선택 계정·모델의 텍스트 호출 완료':'실제 텍스트 호출 미확인'} · {notice}</p>
 {response&&<label>합성 텍스트 응답<textarea readOnly value={response}/></label>}
 <p>현재는 한 ChatGPT 등록 계정을 재인증합니다. 다른 계정의 인증정보로 기존 등록을 덮어쓰지 않습니다. 이미지 분석은 이번 복원 범위에 포함하지 않습니다.</p>
 </section>;
}
