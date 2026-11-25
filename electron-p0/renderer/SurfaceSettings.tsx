import {useState,type ReactNode} from 'react';
import {BrandLogo} from '../../src/branding/BrandLogo';
import {BoardPlacementSettings} from './BoardPlacementSettings';
export function SurfaceSettings({appearance,widgets,dock,desktopSurface,onlineHealthRoom,about,saveStatus,ai,school,initialCategory='appearance'}:{appearance:ReactNode;widgets:ReactNode;dock:ReactNode;desktopSurface?:ReactNode;onlineHealthRoom?:ReactNode;about:ReactNode;saveStatus:string;ai?:ReactNode;school?:ReactNode;initialCategory?:'appearance'|'school'|'onlineHealthRoom'}){
 const [category,setCategory]=useState<'appearance'|'widgets'|'dock'|'desktopSurface'|'onlineHealthRoom'|'about'|'ai'|'school'>(initialCategory);
 const choices=[['appearance','화면'],['widgets','위젯'],['dock','Dock'],...(onlineHealthRoom?[['onlineHealthRoom','온라인 보건실'] as const]:[]),...(desktopSurface?[['desktopSurface','Desktop Palette'] as const]:[]),['about','앱 정보'],...(school?[['school','학교 프로필'] as const]:[]),...(ai?[['ai','AI 연결'] as const]:[])] as const;
 const surfaceBridge = typeof window === 'undefined' ? undefined : window.electronP0?.desktopSurface;
 return <div className="rose-settings"><nav aria-label="설정 카테고리">{choices.map(([id,label])=><button key={id} type="button" aria-pressed={category===id} onClick={()=>setCategory(id)}>{label}</button>)}</nav><section aria-label={choices.find(([id])=>id===category)![1]} className="rose-settings-content">{category==='about'&&<BrandLogo className="rose-settings-brand"/>}{{appearance,widgets,dock,desktopSurface,onlineHealthRoom,about,saveStatus,ai,school}[category]}{category==='appearance'&&surfaceBridge&&<BoardPlacementSettings bridge={surfaceBridge}/>} {saveStatus&&['appearance','widgets','dock'].includes(category)&&<p role="status">{saveStatus}</p>}</section></div>;
}
