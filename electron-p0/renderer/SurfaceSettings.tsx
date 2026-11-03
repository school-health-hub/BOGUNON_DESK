import {useState,type ReactNode} from 'react';
export function SurfaceSettings({appearance,widgets,dock,about,saveStatus}:{appearance:ReactNode;widgets:ReactNode;dock:ReactNode;about:ReactNode;saveStatus:string}){
 const [category,setCategory]=useState<'appearance'|'widgets'|'dock'|'about'>('appearance');
 const choices=[['appearance','화면'],['widgets','위젯'],['dock','Dock'],['about','앱 정보']] as const;
 return <div className="rose-settings"><nav aria-label="설정 카테고리">{choices.map(([id,label])=><button key={id} type="button" aria-pressed={category===id} onClick={()=>setCategory(id)}>{label}</button>)}</nav><section aria-label={choices.find(([id])=>id===category)![1]} className="rose-settings-content">{{appearance,widgets,dock,about,saveStatus}[category]}<p role="status">{saveStatus}</p><p className="rose-settings-note">변경 사항은 이 PC의 PoC 설정에 저장됩니다. 저장 실패 시 상태 안내를 확인해 주세요.</p></section></div>;
}
