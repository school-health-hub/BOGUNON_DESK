import {useState,type ReactNode} from 'react';
export function SurfaceEffectsControl({reduced,onChange}:{readonly reduced:boolean;readonly onChange:(value:boolean)=>void}){
 return <div className="rose-effects-control"><label><input type="checkbox" checked={reduced} onChange={event=>onChange(event.target.checked)}/> 유리 효과 줄이기</label><p>저사양 PC에서는 블러를 끌 수 있습니다. 이번 실행에만 적용하며 저장된 배치와 업무 데이터는 변경하지 않습니다.</p></div>;
}
export function SurfaceSettings({appearance,widgets,dock,about,saveStatus,ai,school}:{appearance:ReactNode;widgets:ReactNode;dock:ReactNode;about:ReactNode;saveStatus:string;ai?:ReactNode;school?:ReactNode}){
 const [category,setCategory]=useState<'appearance'|'widgets'|'dock'|'about'|'ai'|'school'>('appearance');
 const choices=[['appearance','화면'],['widgets','위젯'],['dock','Dock'],['about','앱 정보'],...(school?[['school','학교 프로필'] as const]:[]),...(ai?[['ai','AI 연결'] as const]:[])] as const;
 return <div className="rose-settings"><nav aria-label="설정 카테고리">{choices.map(([id,label])=><button key={id} type="button" aria-pressed={category===id} onClick={()=>setCategory(id)}>{label}</button>)}</nav><section aria-label={choices.find(([id])=>id===category)![1]} className="rose-settings-content">{{appearance,widgets,dock,about,saveStatus,ai,school}[category]}{category!=='ai'&&category!=='school'&&<p role="status">{saveStatus}</p>}<p className="rose-settings-note">{category==='school'?'학교 프로필은 화면 배치·업무 원고와 분리해 이 PC에 저장합니다.':category==='ai'?'AI 연결은 일반 설정 JSON과 분리합니다. 선택한 경우에만 Windows 암호화로 보관합니다.':'변경 사항은 이 PC의 PoC 설정에 저장됩니다. 저장 실패 시 상태 안내를 확인해 주세요.'}</p></section></div>;
}
