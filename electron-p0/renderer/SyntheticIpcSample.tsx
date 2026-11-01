import { useState } from 'react';
export function SyntheticIpcSample(){
 const [message,setMessage]=useState('저장하지 않는 합성 샘플입니다.');
 const [busy,setBusy]=useState(false);
 const run=async()=>{
  setBusy(true);
  try{const result=await window.electronWork.sample.summarize({fixture:'synthetic-only',completed:['prepare']});
   setMessage(result.ok?`합성 항목 ${result.data.total}개 중 ${result.data.completedCount}개 완료`:result.error.message);
  }catch{setMessage('샘플 연결을 완료하지 못했습니다.');}finally{setBusy(false);}
 };
 return <section aria-label="합성 IPC 샘플"><button type="button" disabled={busy} onClick={()=>void run()}>합성 IPC 확인</button><p role="status">{message}</p></section>;
}
