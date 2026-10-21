import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Search} from 'lucide-react';
import {copyMessage,createMessage,filterVideos,FinderInputError,searchMockVideos,validateConditions,type Conditions,type Education,type Video} from './model';
import {libraryRepository} from './library';
import {entryVideo,expireMetadata,toEntry,type LibraryEntry,type LibraryV2} from './libraryV2';
import {FinderSearchError,searchWithSession,type FinderAuthStatus,type SearchDependencies} from './searchService';
import {VideoResults} from './VideoResults';
import {MessageEditor} from './MessageEditor';
import {LibraryPanel} from './LibraryPanel';
import './finder.css';
const emptyEducation:Education={educationTitle:'',target:'',schedule:'',instructions:''};
export type FinderProps={readonly onClose:()=>void;readonly authStatus?:FinderAuthStatus;readonly authIdentity?:string;readonly searchDependencies?:SearchDependencies};
export function EducationVideoFinder({onClose,authStatus='signedOut',authIdentity='',searchDependencies}:FinderProps){
 const [conditions,setConditions]=useState<Conditions>({topic:'',target:'',minutes:10});
 const [searched,setSearched]=useState<Conditions|null>(null);
 const [videos,setVideos]=useState<readonly Video[]>([]);
 const [windowMinutes,setWindow]=useState<number|null>(3);
 const [selected,setSelected]=useState<Video|null>(null);
 const [savedId,setSavedId]=useState<string|null>(null);
 const [education,setEducation]=useState(emptyEducation);
 const [message,setMessage]=useState('');const [notes,setNotes]=useState('');const [confirmed,setConfirmed]=useState(false);
 const [library,setLibrary]=useState<LibraryV2>({version:2,entries:[]});
 const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
 const [mode,setMode]=useState<'mock'|'proxy'>('mock');const requestEpoch=useRef(0);const authSnapshot=useRef('');authSnapshot.current=authStatus+':'+authIdentity;
 const reportError=(error:unknown):void=>setNotice(error instanceof FinderInputError||error instanceof FinderSearchError?error.message:'로컬 라이브러리 작업을 완료하지 못했습니다. 기존 데이터를 유지하고 백업 복구를 시도해 주세요.');
 useEffect(()=>{let active=true;void libraryRepository.load().then(result=>{if(active){setLibrary(result.library);if(result.recovered)setNotice('손상된 저장소 대신 백업을 불러왔습니다.');}}).catch(error=>{if(active)reportError(error);});return()=>{active=false;};},[]);
 useEffect(()=>{requestEpoch.current+=1;setBusy(false);setVideos(current=>current.filter(video=>video.source!=='live'));setSelected(current=>current?.source==='live'?null:current);setConfirmed(false);},[authStatus,authIdentity]);
 useEffect(()=>{
  const videoDeadline=(video:Video|null):number=>video?.expiresAt?Date.parse(video.expiresAt):video?.fetchedAt?Date.parse(video.fetchedAt)+30*86400000:Infinity;
  const deadline=Math.min(videoDeadline(selected),...library.entries.map(entry=>entry.provider?Date.parse(entry.provider.expiresAt):Infinity));
  if(!Number.isFinite(deadline))return;
  let active=true;let timer:ReturnType<typeof setTimeout>;
  const tick=()=>{const remaining=deadline-Date.now();if(remaining>0){timer=setTimeout(tick,Math.min(remaining,2147483647));return;}
   setLibrary(current=>expireMetadata(current));setSelected(current=>videoDeadline(current)<=Date.now()?null:current);setVideos(current=>current.filter(video=>videoDeadline(video)>Date.now()));setConfirmed(false);setNotice('영상 메타데이터의 유효기간이 만료되었습니다. 교사 안내문과 메모는 유지됩니다.');
   void libraryRepository.load().then(result=>{if(active)setLibrary(result.library);}).catch(error=>{if(active)reportError(error);});
  };
  timer=setTimeout(tick,Math.max(0,Math.min(deadline-Date.now(),2147483647)));
  return()=>{active=false;clearTimeout(timer);};
 },[library,selected]);
 const run=async(action:()=>Promise<void>):Promise<void>=>{if(busy)return;setBusy(true);try{await action();}catch(error){reportError(error);}finally{setBusy(false);}};
 const search=async():Promise<void>=>{
  const error=validateConditions(conditions);if(error){setNotice(error);return;}
  const epoch=++requestEpoch.current;const owner=authSnapshot.current;setSearched({...conditions});setWindow(3);
  if(mode==='mock'){setVideos(searchMockVideos(conditions));setNotice('합성 Mock 결과 12개입니다. 실제 YouTube를 검색하지 않았습니다.');return;}
  setBusy(true);setVideos([]);
  try{const result=await searchWithSession(conditions,authStatus,searchDependencies,authIdentity,()=>epoch===requestEpoch.current&&owner===authSnapshot.current);if(epoch===requestEpoch.current&&owner===authSnapshot.current){setVideos(result.results);setNotice(result.results.length?result.notice||'주입된 검색 응답입니다. 실제 외부 호출은 차단되어 있습니다.':'검색 결과가 없습니다. 조건을 변경해 주세요.');}}
  catch(error){if(epoch===requestEpoch.current&&owner===authSnapshot.current)reportError(error);}finally{if(epoch===requestEpoch.current&&owner===authSnapshot.current)setBusy(false);}
 };
 const changeEducation=(value:Education)=>{setEducation(value);setConfirmed(false);};
 const loadItem=(entry:LibraryEntry)=>{setSavedId(entry.videoId);setSelected(entryVideo(entry));setEducation({educationTitle:entry.teacher.educationTitle,target:entry.teacher.target,schedule:entry.teacher.schedule,instructions:entry.teacher.instructions});setMessage(entry.teacher.message);setNotes(entry.teacher.notes);setConfirmed(false);setNotice(entry.provider?'저장된 안내문과 메모를 불러왔습니다.':'영상 메타데이터가 만료되거나 삭제되었습니다. 교사 안내문·메모는 유지되며 새 안내문 생성에는 영상 재선택이 필요합니다.');};
 const choose=(video:Video)=>{const saved=library.entries.find(entry=>entry.videoId===video.videoId);if(saved){loadItem({...saved,provider:toEntry({...video,...saved.teacher}).provider});return;}setSavedId(video.videoId);setSelected(video);setMessage('');setNotes('');setConfirmed(false);setEducation(current=>({...current,educationTitle:current.educationTitle||conditions.topic,target:current.target||conditions.target}));};
 const generate=()=>{const active=selected&&(selected.expiresAt?Date.parse(selected.expiresAt)<=Date.now():selected.fetchedAt?Date.parse(selected.fetchedAt)+30*86400000<=Date.now():false)?null:selected;const result=createMessage(education,active);if(result.missing.length){setNotice(`입력 필요: ${result.missing.join(', ')}`);return;}setMessage(result.text);setConfirmed(false);setNotice('안내문을 생성했습니다. 확인하고 수정한 뒤 복사해 주세요.');};
 const save=()=>void run(async()=>{
  const teacher={...education,message,notes};
  const entry=selected?toEntry({...selected,...teacher}):savedId?{videoId:savedId,teacher,provider:null}:null;
  if(!entry)return;const result=await libraryRepository.save(entry);setLibrary(result.library);setSavedId(entry.videoId);setNotice('독립 라이브러리에 저장했습니다.');
 });
 const exportLibrary=()=>void run(async()=>{const json=await libraryRepository.export();const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='education-video-library-v2.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('라이브러리를 내보냈습니다.');});
 const importLibrary=(file:File|undefined)=>void run(async()=>{if(!file)return;if(file.size>2*1024*1024)throw new FinderInputError('가져오기 파일은 2MB 이하여야 합니다.');const result=await libraryRepository.import(await file.text());setLibrary(result.library);setNotice('가져왔습니다. 교사 메모·수정문은 유지하고 유효한 메타데이터만 갱신했습니다.');});
 const deleteMetadata=(id:string)=>void run(async()=>{const result=await libraryRepository.deleteMetadata(id);setLibrary(result.library);if(savedId===id){setSelected(null);setConfirmed(false);}setNotice('영상 메타데이터만 삭제했습니다. 교사 안내문과 메모는 유지됩니다.');});
 const refreshMetadata=(id:string)=>void run(async()=>{const video=videos.find(row=>row.videoId===id);if(!video){setNotice('같은 영상의 현재 검색 결과가 필요합니다. 외부 검색은 차단되어 있습니다.');return;}const entry=toEntry({...video,...emptyEducation,message:'',notes:''});if(!entry.provider)return;const result=await libraryRepository.refreshMetadata(id,entry.provider);setLibrary(result.library);if(savedId===id)setSelected(video);setNotice('현재 결과의 메타데이터만 갱신했습니다. 교사 메모와 수정문은 유지됩니다.');});
 const shown=filterVideos(videos,searched?.minutes??conditions.minutes,windowMinutes);
 return <main className="ev-finder">
 <header className="ev-header"><div><button type="button" onClick={onClose}><ArrowLeft size={16}/>보건 업무로</button><span className="ev-eyebrow">BOGUNON DESK · PHASE 2B</span><h1>AI 교육영상 Finder <small>v1.1</small></h1><p>교육에 맞는 영상을 비교하고, 선생님의 안내문으로 정리하세요.</p></div><span className="ev-mock-badge">{mode==='mock'?'합성 Mock 전용':'서버 연결 준비 · 실호출 차단'}</span></header>
 <div className="ev-mock-note"><strong>Phase 2B에서는 실제 외부 검색이 차단되어 있습니다.</strong> 로컬 Mock은 모든 제목·채널·영상 ID가 합성입니다. 프록시 경로는 로그인·응답 처리를 검증하기 위한 준비 단계이며 운영 YouTube를 호출하지 않습니다.</div>
 <section className="ev-search" aria-labelledby="ev-search-heading"><div className="ev-section-heading"><div><span className="ev-step">01</span><h2 id="ev-search-heading">교육 조건</h2></div></div>
 <div className="ev-filters" aria-label="검색 모드"><button type="button" aria-pressed={mode==='mock'} onClick={()=>{requestEpoch.current+=1;setMode('mock');setVideos([]);setSearched(null);setBusy(false);setNotice('로컬 Mock은 합성 검색 결과를 사용하며 로그인 없이 이용할 수 있습니다.');}}>로컬 Mock</button><button type="button" aria-pressed={mode==='proxy'} onClick={()=>{requestEpoch.current+=1;setMode('proxy');setVideos([]);setSearched(null);setBusy(false);setNotice('서버 검색은 로그인 확인이 필요합니다. 이번 단계에서는 실제 외부 호출이 차단되어 있습니다.');}}>서버 검색 준비</button><span>{authStatus==='signedIn'?'BOGUNON 로그인됨':authStatus==='loading'?'로그인 확인 중':'로그인 필요 · Mock 이용 가능'}</span></div>
 <form onSubmit={e=>{e.preventDefault();void search();}}><label>교육 주제<input maxLength={100} value={conditions.topic} placeholder="예: 손씻기와 감염병 예방" onChange={e=>setConditions({...conditions,topic:e.target.value})}/></label><label>검색 대상<input maxLength={100} value={conditions.target} placeholder="예: 초등학교 3~4학년" onChange={e=>setConditions({...conditions,target:e.target.value})}/></label><label>희망 영상 길이(분)<input type="number" min={1} max={180} value={conditions.minutes} onChange={e=>setConditions({...conditions,minutes:Number(e.target.value)})}/></label><button className="ev-primary" type="submit" disabled={busy||(mode==='proxy'&&authStatus!=='signedIn')}><Search size={17}/>{busy?'검색 준비 중…':mode==='mock'?'Mock 영상 검색':'서버 검색(외부 호출 차단)'}</button></form></section>
 <p role="status" className="ev-notice">{notice||'Mock과 안내문 생성은 외부 API 없이 동작합니다.'}</p><div className="ev-layout"><div>
 <div className="ev-filters" aria-label="영상 길이 범위">{[{value:3,label:'희망 길이 ±3분'},{value:5,label:'±5분'},{value:null,label:'전체 보기'}].map(option=><button type="button" key={option.label} aria-pressed={windowMinutes===option.value} onClick={()=>setWindow(option.value)}>{option.label}</button>)}<span>가까운 길이순 · 길이 미확인은 전체 보기</span></div>
 <VideoResults hasSearched={searched!==null} videos={shown} total={videos.length} selected={selected} onSelect={choose}/>
 <LibraryPanel library={library} busy={busy} onExport={exportLibrary} onImport={importLibrary} onLoad={loadItem} onDelete={deleteMetadata} onRefresh={refreshMetadata} onRecover={()=>void run(async()=>{const result=await libraryRepository.recover();setLibrary(result.library);setNotice('백업에서 복구했습니다. 만료 메타데이터는 제거하고 교사 자료를 유지했습니다.');})}/>
 </div><MessageEditor education={education} video={selected} canSaveTeacher={savedId!==null&&(selected===null||library.entries.some(entry=>entry.videoId===savedId))} message={message} notes={notes} confirmed={confirmed} onEducation={changeEducation} onMessage={value=>{setMessage(value);setConfirmed(false);}} onNotes={setNotes} onConfirm={setConfirmed} onGenerate={generate} onCopy={()=>void copyMessage(message,confirmed,value=>navigator.clipboard.writeText(value)).then(setNotice)} onSave={save}/></div></main>;
}
