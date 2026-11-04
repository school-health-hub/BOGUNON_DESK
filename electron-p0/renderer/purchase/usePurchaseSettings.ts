import {useEffect,useRef,useState} from 'react';
import type {PurchaseSettingsDocument,PurchaseSettingsLoad} from '../../purchase-settings-protocol';

export function usePurchaseSettings(){
 const api=window.electronWork.purchase.settings;
 const [loaded,setLoaded]=useState<PurchaseSettingsLoad|null>(null),[busy,setBusy]=useState(!!api),[message,setMessage]=useState('');
 const [readError,setReadError]=useState(false);
 const live=useRef(true),running=useRef(false),current=useRef(loaded);current.current=loaded;
 const load=async()=>{
  if(!api||running.current)return;running.current=true;setBusy(true);
  try{const result=await api.load();if(!result.ok)throw Error(result.error.message);if(live.current){current.current=result.data;setLoaded(result.data);setReadError(false);setMessage(result.data.recovered?'백업 설정을 읽었습니다. 손상된 원본 보호를 위해 설정 변경을 차단합니다.':'Purchase 설정을 이 PC에서 불러왔습니다.');}}
  catch(e){if(live.current){setReadError(true);setMessage(e instanceof Error?e.message:'설정을 읽지 못했습니다. 기존 파일을 보존합니다.');}}
  finally{running.current=false;if(live.current)setBusy(false);}
 };
 useEffect(()=>{live.current=true;void load();return()=>{live.current=false;};},[api]);
 const save=async(patch:Partial<Pick<PurchaseSettingsDocument,'draftTemplates'|'importTemplates'|'outputColumns'>>):Promise<boolean>=>{
  if(!api||!current.current||readError||current.current.recovered||running.current)return false;
  const before=current.current.document;running.current=true;setBusy(true);
  try{const result=await api.save({...before,...patch},before.revision);if(!result.ok)throw Error(result.error.message);if(live.current){current.current=result.data;setLoaded(result.data);setMessage('Purchase 설정을 이 PC에 저장했습니다.');}return true;}
  catch(e){if(live.current)setMessage(e instanceof Error?e.message:'설정 저장에 실패했습니다. 이전 설정·품목·원고를 보존합니다.');return false;}
  finally{running.current=false;if(live.current)setBusy(false);}
 };
 return {document:loaded?.document,ready:!!api&&!!loaded&&!loaded.recovered&&!readError,busy,message,load,save};
}
