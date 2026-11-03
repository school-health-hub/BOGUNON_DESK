import {useEffect,useRef,useState} from 'react';
import type {AiBridge,AiProvider,AiStatus,AiTool,IpcResult} from '../../protocol';
import {evaluateOfficialDocumentOutbound} from '../../../src/official-document/officialDocumentAiService';
import {officialDocumentPrivacyNotice} from '../../../src/official-document/privacyGuard';
import './ai.css';
const read=<T,>(result:IpcResult<T>):T=>{if(!result.ok)throw Error(result.error.message);return result.data;};
export function AiSettings(){
 const api=window.electronWork?.ai;
 const [state,setState]=useState<AiStatus|null>(null),[provider,setProvider]=useState<AiProvider>('openai'),[remember,setRemember]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const active=useRef(true);
 useEffect(()=>{active.current=true;if(api)void api.status().then(result=>{if(active.current)setState(read(result));}).catch(()=>{if(active.current)setNotice('AI 연결 상태를 읽지 못했습니다.');});return()=>{active.current=false};},[api]);
 const run=async(operation:()=>Promise<AiStatus|null>)=>{if(busy)return;setBusy(true);try{const next=await operation();if(active.current){if(next)setState(next);setNotice(next?next.connected?'API 계정 모델 목록을 확인했습니다. 텍스트 호출은 전송 전 별도 확인합니다.':'API 연결을 해제했습니다.':'연결을 취소했습니다.');}}catch(error){if(active.current){setNotice(error instanceof Error?error.message:'AI 연결을 완료하지 못했습니다.');if(api)void api.status().then(result=>{if(active.current&&result.ok)setState(result.data);});}}finally{if(active.current)setBusy(false);}};
 if(!api)return <p>이 실행본은 Electron AI 연결을 지원하지 않습니다.</p>;
 return <section className="electron-ai" aria-label="AI 연결 설정"><h2>AI 연결</h2><p>공문·소식지·Finder에서 공통으로 사용합니다. API Key와 원고는 설정 JSON이나 로그에 기록하지 않습니다.</p>
  <fieldset disabled={busy}><legend>API 계정 연결</legend><label>AI 제공자<select value={provider} onChange={e=>setProvider(e.target.value as AiProvider)}><option value="openai">OpenAI API</option><option value="gemini">Gemini API</option></select></label>
  <p>본인 API Key를 클립보드에 복사한 뒤 아래 버튼을 누르세요. Main에서만 읽고 연결 성공 후 클립보드에서 지웁니다. Key를 이 화면에 다시 표시하지 않습니다. API 요금은 ChatGPT 구독과 별도입니다.</p>
  <label><input type="checkbox" checked={remember} disabled={!state?.secureStorage} onChange={e=>setRemember(e.target.checked)}/>이 PC에 Windows 암호화로 연결 보관</label><p>{state?.secureStorage?'보관을 선택하지 않으면 앱 종료 시 연결이 사라지고 기존 Electron 저장 연결도 제거됩니다.':'안전한 영구 저장을 사용할 수 없어 세션 연결만 가능합니다.'}</p>
  <button type="button" onClick={()=>void run(async()=>read(await api.connectFromClipboard({provider,remember})))}>클립보드 API Key로 연결</button>
  <button type="button" disabled={!state?.stored} onClick={()=>void run(async()=>read(await api.restore()))}>저장 연결 불러와 확인</button>
  </fieldset>
  <p role="status">{state?.connected?`${state.provider} · ${state.model} 연결됨`:'API 미연결'}{state?.stored?' · 암호화된 연결 보관 중':''}</p>
  {state?.connected&&<label>계정에서 조회한 모델<select aria-label="AI 모델" value={state.model??''} disabled={busy} onChange={e=>void run(async()=>read(await api.selectModel({model:e.target.value})))}>{state.models.map(model=><option key={model.id} value={model.id}>{model.label}</option>)}</select></label>}
  <p>조회된 모델이라도 텍스트 호출 권한·지원 여부는 실제 요청에서 확인합니다. 연결 확인은 유료 생성 성공을 의미하지 않습니다.</p>
  <button type="button" disabled={busy} onClick={()=>void run(async()=>read(await api.disconnect()))}>로그아웃·저장 연결 삭제</button>{busy&&<button type="button" onClick={()=>void api.cancel()}>AI 연결 요청 취소</button>}
  <p role="status">{notice}</p>
  <h3>ChatGPT 계정·요금제 연결 — 미지원</h3><p>기존 Tauri의 별도 로그인·요금제 호출 기반 코드는 보존했습니다. 현재 Electron용 승인된 로그인 경로와 요금제 사용 권한을 확인하지 못해 비활성 상태입니다. 구독 계정을 API Key로 대신 사용하거나 인증을 우회하지 않습니다.</p>
 </section>;
}
export function AiAssistant({tool,source,onSettings,active=true}:{tool:AiTool;source:string;onSettings:()=>void;active?:boolean}){
 const api:AiBridge|undefined=window.electronWork?.ai;
 const [prompt,setPrompt]=useState(''),[text,setText]=useState(''),[confirmed,setConfirmed]=useState(false),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const epoch=useRef(0),mounted=useRef(true),owned=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;if(owned.current)void api?.cancel();};},[api]);
 useEffect(()=>{if(!active&&owned.current){epoch.current++;owned.current=false;void api?.cancel();setBusy(false);setConfirmed(false);}},[active,api]);
 const evaluation=evaluateOfficialDocumentOutbound(prompt);
 const send=async()=>{
  if(!active||!api||busy||!confirmed||!evaluation.canConfirm)return;
  const token=++epoch.current;owned.current=true;setBusy(true);setNotice('Main에서 제공자·모델과 전송 내용을 최종 확인해 주세요.');
  try{const result=read(await api.generate({tool,prompt}));if(!mounted.current||token!==epoch.current)return;
   if(result){setText(result.text);setNotice('AI 응답을 받았습니다. 사실·개인정보를 검토한 뒤 필요한 부분만 복사해 기존 편집기에 반영하세요.');}else setNotice('외부 전송을 취소했습니다. 기존 원고와 이전 응답은 유지됩니다.');
  }catch(error){if(mounted.current&&token===epoch.current)setNotice(error instanceof Error?error.message:'AI 요청에 실패했습니다. 기존 원고는 유지됩니다.');}
  finally{if(mounted.current&&token===epoch.current){owned.current=false;setBusy(false);setConfirmed(false);}}
 };
 if(!api)return null;
 return <details className="electron-ai"><summary>AI 작성 보조 · 외부 전송 전 확인</summary><button type="button" disabled={busy} onClick={onSettings}>공통 AI 연결 설정</button><p>자동 전송·자동 저장·원고 자동 교체는 하지 않습니다. 실제 학생·학교 개인정보를 넣지 마세요.</p>
  <button type="button" disabled={busy||!source.trim()} onClick={()=>{if(prompt&&!window.confirm('작성 중인 전송 내용을 현재 원고로 바꿀까요?'))return;setPrompt(source);setConfirmed(false);}}>현재 작업 내용 검토용으로 가져오기</button>
  <label>AI 전송 내용<textarea aria-label="AI 전송 내용" rows={8} maxLength={60000} disabled={busy} value={prompt} onChange={e=>{setPrompt(e.target.value);setConfirmed(false);}}/></label><p>{evaluation.bytes.toLocaleString()} / 65,536 bytes · {officialDocumentPrivacyNotice}</p>
  {!evaluation.canConfirm&&prompt&&<p role="alert">{evaluation.findings.length?'개인정보 가능 항목: '+evaluation.findings.join(', '):'빈 내용 또는 전송 크기 제한을 확인해 주세요.'}</p>}
  <label><input type="checkbox" checked={confirmed} disabled={busy||!evaluation.canConfirm} onChange={e=>setConfirmed(e.target.checked)}/>내용을 검토했고 개인정보가 없으며 선택한 외부 제공자에게 전송하는 데 동의합니다.</label>
  <button type="button" disabled={busy||!confirmed||!evaluation.canConfirm} onClick={()=>void send()}>검토 후 AI 요청</button>{busy&&<button type="button" onClick={()=>{epoch.current++;owned.current=false;setBusy(false);setConfirmed(false);void api.cancel();setNotice('취소를 요청했습니다. 이미 전송된 내용은 회수할 수 없습니다. 원고는 유지됩니다.');}}>AI 요청 취소</button>}
  <p role="status">{notice}</p>{text&&<><label>AI 응답 · 검토용<textarea aria-label="AI 응답" rows={8} readOnly value={text}/></label><button type="button" onClick={()=>void navigator.clipboard.writeText(text).then(()=>setNotice('검토용 응답을 복사했습니다.'),()=>setNotice('복사하지 못했습니다. 응답을 직접 선택해 주세요.'))}>AI 응답 복사</button></>}
 </details>;
}
