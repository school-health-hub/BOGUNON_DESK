import {createContext,useContext,useEffect,useState,useId,type ReactNode} from 'react';
import {StickyNote} from 'lucide-react';
import {Panel} from '../../../src/components/Panel';
import {QuickMemoEditor} from '../../../src/components/desktop/QuickMemoEditor';
import {useDesktopPanels} from '../../../src/components/desktop/DesktopPanelContext';
type State={text:string;setText:(text:string)=>void;ready:boolean;busy:boolean;status:string;save:()=>Promise<void>;load:()=>Promise<void>};
const Context=createContext<State|null>(null);
export function PersistentMemoProvider({children}:{children:ReactNode}){
 const [text,setText]=useState(''),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState('메모 불러오는 중');
 const load=async()=>{setBusy(true);try{const r=await window.electronWork.memo.read();if(r.ok){setText(r.data.text);setReady(true);setStatus('메모 불러옴');}else{setReady(false);setStatus(r.error.message);}}catch{setReady(false);setStatus('메모 연결 실패');}finally{setBusy(false);}};
 useEffect(()=>{void load();},[]);
 const save=async()=>{setBusy(true);try{const r=await window.electronWork.memo.write({version:1,text});setStatus(r.ok?'메모 저장됨':r.error.message);}catch{setStatus('메모 연결 실패 — 입력 내용을 유지합니다.');}finally{setBusy(false);}};
 return <Context.Provider value={{text,setText:value=>{setText(value);setStatus('메모 변경됨 — 저장해 주세요');},ready,busy,status,save,load}}>{children}</Context.Provider>;
}
export function MemoWidget(){
 const id=useId();const state=useContext(Context);if(!state)throw Error('Memo provider required');
 const {notify,openQuickAddFromMemo,openQuickMemoUrl}=useDesktopPanels();
 return <Panel title="빠른 메모" icon={StickyNote} className="memo-panel" action={<div className="quick-memo-actions"><button type="button" disabled={!state.ready||state.busy} onClick={()=>void state.save()}>메모 저장</button></div>}>
  <fieldset disabled={state.busy} style={{border:0,padding:0,margin:0,minWidth:0,minHeight:0,height:'100%',overflow:'auto'}}>
   {state.ready?<QuickMemoEditor id={`electron-quick-memo-${id}`} memo={state.text} mode="widget" onChange={state.setText} onCreateTask={openQuickAddFromMemo} onNotice={notify} onOpenUrl={openQuickMemoUrl}/>:<button type="button" onClick={()=>void state.load()}>메모 다시 불러오기</button>}
  </fieldset>
  <p role="status" data-memo-status title="Electron 전용 로컬 메모 · 저장 버튼을 눌러 보관하세요.">{state.status}</p>
 </Panel>;
}
