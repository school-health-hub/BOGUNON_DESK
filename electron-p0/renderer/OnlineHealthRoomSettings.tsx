import {useEffect,useState} from 'react';
import type {OnlineHealthRoomSettings as Settings} from '../online-health-room-protocol.js';

export function OnlineHealthRoomSettings({settings,onSaved}:{settings:Settings;onSaved:(next:Settings)=>void}){
  const [enabled,setEnabled]=useState(settings.enabled),[url,setUrl]=useState(settings.url),[busy,setBusy]=useState(false),[message,setMessage]=useState('주소를 저장하면 기본 브라우저에서 온라인 보건실을 열 수 있습니다.');
  useEffect(()=>{setEnabled(settings.enabled);setUrl(settings.url);},[settings]);
  const changed=enabled!==settings.enabled||url!==settings.url;
  const save=async()=>{setBusy(true);try{const next=await window.electronP0.onlineHealthRoom.save({enabled,url});onSaved(next);setMessage('온라인 보건실 설정을 이 PC에 저장했습니다.');}catch(error){setMessage(error instanceof Error?error.message:'설정을 저장하지 못했습니다. 입력값을 확인해 주세요.');}finally{setBusy(false);}};
  const test=async()=>{setBusy(true);try{await window.electronP0.onlineHealthRoom.test(url);setMessage('기본 브라우저를 열었습니다. 사이트 접속과 로그인은 브라우저에서 직접 확인해 주세요.');}catch(error){setMessage(error instanceof Error?error.message:'브라우저를 열지 못했습니다. 주소와 기본 브라우저를 확인해 주세요.');}finally{setBusy(false);}};
  return <section className="online-health-room-settings" aria-label="온라인 보건실 설정">
    <h2>온라인 보건실</h2><p>학교에서 사용하는 온라인 보건실 주소를 등록하세요. 로그인 정보는 BOGUNON DESK에 저장하지 않습니다.</p>
    <label className="online-health-room-toggle"><input type="checkbox" checked={enabled} disabled={busy} onChange={event=>setEnabled(event.currentTarget.checked)}/> 온라인 보건실 사용</label>
    <label htmlFor="online-health-room-url">학교 온라인 보건실 URL</label>
    <input id="online-health-room-url" type="url" inputMode="url" autoComplete="off" spellCheck={false} maxLength={2048} value={url} onChange={event=>setUrl(event.currentTarget.value)} placeholder="https://health.school.edu.kr/" disabled={busy}/>
    <p className="online-health-room-help">공개 HTTPS 주소만 저장할 수 있습니다. 연결 테스트는 기본 브라우저를 열며, 실제 접속 여부는 브라우저에서 확인합니다.</p>
    <div className="online-health-room-actions"><button type="button" disabled={busy||!url} onClick={()=>void test()}>브라우저에서 연결 테스트</button><button type="button" disabled={busy||!changed} onClick={()=>void save()}>저장</button><button type="button" disabled={busy||!url} onClick={()=>{setUrl('');setMessage('주소를 비웠습니다. 저장을 눌러 적용하세요.');}}>주소 초기화</button></div>
    <p role="status" aria-live="polite">{busy?'처리 중…':message}</p>
  </section>;
}
