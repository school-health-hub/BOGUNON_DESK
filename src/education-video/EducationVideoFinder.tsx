import type {FinderCompatBridge} from '../../electron-p0/finder-v2-protocol';
import {FinderCompatibility} from '../../electron-p0/renderer/finder/FinderCompatibility';
import type {FinderSearchBridge,FinderSearchStatus} from '../../electron-p0/finder-search-protocol';
import {SearchConnection} from './SearchConnection';
import { useEffect, useState, useRef, type ReactNode } from 'react';
import { ArrowLeft, Download, Library as LibraryIcon, Search, Upload } from 'lucide-react';
import { copyMessage, createMessage, filterVideos, FinderInputError, searchMockVideos, validateConditions, type Conditions, type Education, type Library, type LibraryItem, type Video } from './model';
import { libraryRepository, nativeLibrary } from './library';
import { VideoResults } from './VideoResults';
import { MessageEditor } from './MessageEditor';
import './finder.css';
const emptyEducation: Education = { educationTitle: '', target: '', schedule: '', instructions: '' };
const recoveryMessage = '저장된 교육영상 목록에 문제가 발견되어 백업에서 복구했습니다. 현재 목록을 확인해 주세요.';
export function EducationVideoFinder({ onClose,renderAiTools,searchBridge,compatBridge }: {
    readonly onClose: () => void;
    readonly compatBridge?:FinderCompatBridge;
    readonly searchBridge?:FinderSearchBridge;
    readonly renderAiTools?:(text:string)=>ReactNode;
}) {
    const [mode,setMode]=useState<'youtube'|'mock'>(searchBridge?'youtube':'mock');
    const [provider,setProvider]=useState<FinderSearchStatus|null>(null),[connectionBusy,setConnectionBusy]=useState(false),[searchBusy,setSearchBusy]=useState(false),[consent,setConsent]=useState(false),[nextCursor,setNextCursor]=useState<string|null>(null);
    const searchEpoch=useRef(0),searching=useRef(false);
    useEffect(()=>()=>{searchEpoch.current++;void searchBridge?.cancel();},[searchBridge]);
    const [conditions, setConditions] = useState<Conditions>({ topic: '', target: '', minutes: 10 });
    const [searched, setSearched] = useState<Conditions | null>(null);
    const [videos, setVideos] = useState<readonly Video[]>([]);
    const [windowMinutes, setWindow] = useState<number | null>(3);
    const [selected, setSelected] = useState<Video | null>(null);
    const [education, setEducation] = useState(emptyEducation);
    const [message, setMessage] = useState('');
    const [notes, setNotes] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [library, setLibrary] = useState<Library>({ version: 1, items: [] });
    const [notice, setNotice] = useState('');
    const [showRecovery, setShowRecovery] = useState(false);
    const initialLoad = useRef<ReturnType<typeof libraryRepository.load> | null>(null);
    const [busy, setBusy] = useState(false);
    const reportError = (error: unknown): void => { setNotice(error instanceof FinderInputError ? error.message : '로컬 라이브러리 작업을 완료하지 못했습니다. 기존 데이터를 유지하고 백업 복구를 시도해 주세요.'); };
    useEffect(() => {
        let active = true;
        initialLoad.current ??= libraryRepository.load();
        void initialLoad.current.then(result => {
            if (!active) return;
            setLibrary(result.library);
            if (result.recovered) setShowRecovery(true);
        }).catch(error => { if (active) reportError(error); });
        return () => { active = false; };
    }, []);
    const run = async (action: () => Promise<void>): Promise<void> => { if (busy)
        return; setBusy(true); try {
        await action();
    }
    catch (error) {
        reportError(error);
    }
    finally {
        setBusy(false);
    } };
    const cancelSearch=()=>{searchEpoch.current++;setNextCursor(null);void searchBridge?.cancel();setNotice('검색 취소를 요청했습니다. 기존 결과·보관함·메모는 유지됩니다.');};
    const search = async (more=false) => {
        const error=validateConditions(conditions);if(error){setNotice(error);return;}
        if(searching.current||connectionBusy)return;
        if(mode==='mock'){setSearched({...conditions});setVideos(searchMockVideos(conditions));setWindow(3);setNextCursor(null);setNotice('합성 Mock 결과 12개입니다. 실제 YouTube를 검색하지 않았습니다.');return;}
        if(!searchBridge||!provider?.configured){setNotice('YouTube 검색 API 연결 설정에서 전용 API Key를 먼저 등록해 주세요.');return;}
        if(!consent){setNotice('개인정보 없는 검색어의 외부 전송에 동의해 주세요.');return;}
        if(more&&(!nextCursor||JSON.stringify(conditions)!==JSON.stringify(searched))){setNotice('검색 조건이 변경됐습니다. 새로 검색해 주세요.');return;}
        const token=++searchEpoch.current;searching.current=true;setSearchBusy(true);setNotice('YouTube 검색 중… 기존 보관함·원고는 변경하지 않습니다.');
        try{const result=await searchBridge.search({conditions:{...conditions},consent:true,...(more?{cursor:nextCursor!}:{})});if(token!==searchEpoch.current)return;if(!result.ok){setNotice(result.error.message);return;}
            setSearched({...conditions});setVideos(current=>more?[...current,...result.data.videos.filter(v=>!current.some(c=>c.videoId===v.videoId))]:result.data.videos);setNextCursor(result.data.nextCursor);if(!more)setWindow(3);
            setNotice(result.data.videos.length?`실제 YouTube 검색 ${result.data.page}/3페이지 · 새 영상 ${result.data.videos.length}개${result.data.omitted?' · 길이 확인 불가/비공개 등 제외 '+result.data.omitted+'개':''}. 교육 적합성은 직접 확인하세요.`:'새 검색 결과가 없습니다. 삭제·비공개·길이 미확인 영상은 표시하지 않습니다.');
        }catch{if(token===searchEpoch.current)setNotice('YouTube 검색을 완료하지 못했습니다. 보관함·메모와 이전 결과는 유지됩니다.');}
        finally{searching.current=false;setSearchBusy(false);}
    };
    const openOriginal=(video:Video)=>{if(!searchBridge||video.source!=='youtube')return;void searchBridge.openVideo({videoId:video.videoId}).then(result=>setNotice(result.ok?'영상 원본의 기본 브라우저 실행을 요청했습니다.':result.error.message)).catch(()=>setNotice('원본 영상을 열지 못했습니다. 기본 브라우저를 확인하세요.'));};
    const changeEducation = (value: Education) => { setEducation(value); setConfirmed(false); };
    const choose = (video: Video) => { const saved = library.items.find(item => item.videoId === video.videoId); if (saved) {
        loadItem(saved);
        return;
    } setSelected(video); setMessage(''); setNotes(''); setConfirmed(false); setEducation(current => ({ ...current, educationTitle: current.educationTitle || conditions.topic, target: current.target || conditions.target })); };
    const generate = () => { const result = createMessage(education, selected); if (result.missing.length) {
        setNotice(`입력 필요: ${result.missing.join(', ')}`);
        return;
    } setMessage(result.text); setConfirmed(false); setNotice('안내문을 생성했습니다. 확인하고 수정한 뒤 복사해 주세요.'); };
    const save = () => void run(async () => { if (!selected)
        return; const result = await libraryRepository.save({ ...selected, ...education, message, notes }); setLibrary(result.library); setNotice('독립 라이브러리에 저장했습니다.'); });
    const loadItem = (item: LibraryItem) => { setSelected(item); setEducation({ educationTitle: item.educationTitle, target: item.target, schedule: item.schedule, instructions: item.instructions }); setMessage(item.message); setNotes(item.notes); setConfirmed(false); setNotice('저장된 안내문과 메모를 불러왔습니다.'); };
    const exportLibrary = () => void run(async () => { try { const result = await libraryRepository.exportFile(); setNotice(result.status === 'saved' ? `라이브러리 JSON을 저장했습니다: ${result.fileName}` : '라이브러리 JSON 저장을 취소했습니다.'); } catch (error) { setNotice(error instanceof FinderInputError ? error.message : '라이브러리 JSON을 저장하지 못했습니다. 기존 라이브러리는 유지됩니다.'); } });
    const importLibrary = (file: File | undefined) => void run(async () => {
        if (!file)
            return;
        if (file.size > 2 * 1024 * 1024)
            throw new FinderInputError('가져오기 파일은 2MB 이하여야 합니다.');
        const result = await libraryRepository.import(await file.text());
        setLibrary(result.library);
        setNotice('가져왔습니다. 중복 영상의 기존 메모와 안내문을 유지했습니다.');
    });
    const shown = filterVideos(videos, searched?.minutes ?? conditions.minutes, windowMinutes);
    return <main className="ev-finder">
 <header className="ev-header"><div>
 <button type="button" onClick={onClose}><ArrowLeft size={16}/>보건 업무로</button>
 <span className="ev-eyebrow">BOGUNON DESK · PHASE 1</span>
 <h1>AI 교육영상 Finder <small>v1.1</small></h1>
 <p>교육에 맞는 영상을 비교하고, 선생님의 안내문으로 정리하세요.</p>
 </div><span className="ev-mock-badge">{mode==='youtube'?'YouTube 공식 API 검색':'합성 Mock 전용'}</span></header>
 {mode==='mock'&&<div className="ev-mock-note"><strong>실제 YouTube 검색 결과가 아닙니다.</strong>
 모든 제목·채널·영상 ID·공식 채널 예시는 합성 데이터입니다. 링크는 실제 영상으로 확인되지 않았으며, 안내문에도 Mock 표시가 포함됩니다.</div>}
 {renderAiTools?.([education.educationTitle,education.target,education.schedule,education.instructions,message].filter(Boolean).join('\n'))}
 <section className="ev-search" aria-labelledby="ev-search-heading">
 <div className="ev-section-heading"><div><span className="ev-step">01</span><h2 id="ev-search-heading">교육 조건</h2></div></div>
 {searchBridge&&<><SearchConnection bridge={searchBridge} disabled={searchBusy} onStatus={value=>{setProvider(value);setNextCursor(null);}} onBusy={setConnectionBusy}/><label>검색 방식<select value={mode} disabled={searchBusy||connectionBusy} onChange={e=>{searchEpoch.current++;setMode(e.target.value as 'youtube'|'mock');setVideos([]);setSearched(null);setNextCursor(null);setConsent(false);setNotice('검색 방식을 변경했습니다. 보관함과 편집 내용은 유지됩니다.');}}><option value="youtube">실제 YouTube 검색</option><option value="mock">합성 Mock 체험 (외부 전송 없음)</option></select></label></>}
 <form onSubmit={e => { e.preventDefault(); void search(); }}>
 <label>교육 주제<input disabled={searchBusy||connectionBusy} maxLength={100} value={conditions.topic} placeholder="예: 손씻기와 감염병 예방" onChange={e => {setConditions({ ...conditions, topic: e.target.value });setConsent(false);setNextCursor(null);}}/></label>
 <label>검색 대상<input disabled={searchBusy||connectionBusy} maxLength={100} value={conditions.target} placeholder="예: 초등학교 3~4학년" onChange={e => {setConditions({ ...conditions, target: e.target.value });setConsent(false);setNextCursor(null);}}/></label>
 <label>희망 영상 길이(분)<input disabled={searchBusy||connectionBusy} type="number" min={1} max={180} value={conditions.minutes} onChange={e => setConditions({ ...conditions, minutes: Number(e.target.value) })}/></label>
 {mode==='youtube'&&<label className="ev-confirm"><input type="checkbox" checked={consent} disabled={searchBusy||connectionBusy} onChange={e=>setConsent(e.target.checked)}/>학생·교직원 개인정보 없는 검색어를 YouTube에 전송하는 데 동의합니다.</label>}
 <button className="ev-primary" type="submit" disabled={searchBusy||connectionBusy}><Search size={17}/>{searchBusy?'YouTube 검색 중…':mode==='youtube'?'YouTube 영상 검색':'Mock 영상 검색'}</button>{searchBusy&&<button type="button" onClick={cancelSearch}>영상 검색 취소</button>}
 </form></section>
 <p role="status" className="ev-notice">{notice || (mode==='youtube'?'YouTube 전용 Key를 등록하고 검색어 전송에 동의해 검색하세요. 실제 API 권한은 요청 시 확인합니다.':'Mock 검색과 기본 안내문은 로컬에서 동작합니다. AI 보조는 전송 전 별도 확인합니다.')}</p>
 {showRecovery&&<p role="status" className="ev-notice">{recoveryMessage}</p>}
 <div className="ev-layout"><div>
 <div className="ev-filters" aria-label="영상 길이 범위">
 {[{ value: 3, label: '희망 길이 ±3분' }, { value: 5, label: '±5분' }, { value: null, label: `전체 보기 (${videos.length}개)` }].map(option => <button type="button" key={option.label} aria-pressed={windowMinutes === option.value} onClick={() => setWindow(option.value)}>{option.label}</button>)}<span>가까운 길이순</span>
 </div>
 <VideoResults videos={shown} total={videos.length} selected={selected} onSelect={choose} onOpen={searchBridge?openOriginal:undefined} realSearch={mode==='youtube'}/>
 {mode==='youtube'&&nextCursor&&<button type="button" disabled={searchBusy||connectionBusy||!consent} onClick={()=>void search(true)}>YouTube 결과 더 검색 (최대 3페이지)</button>}
 <section className="ev-library" aria-labelledby="ev-library-heading">
 <div className="ev-section-heading"><div><LibraryIcon size={20}/><h2 id="ev-library-heading">내 로컬 라이브러리</h2></div><span>{library.items.length}개</span></div>
 <p className="ev-muted">{nativeLibrary ? '이 PC의 education-video 전용 JSON 저장소에 보관합니다.' : '브라우저 QA 모드: 이 브라우저의 localStorage만 사용합니다. 네이티브 파일 저장·복구 보장이 아닙니다.'}</p>
 <div className="ev-actions">
 <button type="button" disabled={busy} onClick={exportLibrary}><Download size={16}/>내보내기</button>
 {!compatBridge&&<label className="ev-import"><Upload size={16}/>가져오기<input type="file" accept=".json,application/json" disabled={busy} onChange={e => { importLibrary(e.target.files?.[0]); e.target.value = ''; }}/></label>}
 <button type="button" disabled={busy} onClick={() => void run(async () => {
     setShowRecovery(false);
     const result = await libraryRepository.recover();
     setLibrary(result.library);
     setShowRecovery(result.recovered);
     setNotice(result.recovered ? '' : '복구가 필요한 라이브러리가 없습니다.');
 })}>백업 복구</button>
 </div>
 {compatBridge&&<FinderCompatibility bridge={compatBridge} onV1Changed={setLibrary}/>}
 {library.items.length === 0 ? <p className="ev-empty-inline">저장한 영상이 없습니다. 안내문을 작성한 뒤 저장해 주세요.</p> : <ul>{library.items.map(item => <li key={item.videoId}><div><strong>{item.educationTitle || item.title}</strong><p>{item.schedule} · {item.target}</p></div><button type="button" onClick={() => loadItem(item)}>불러오기</button></li>)}</ul>}
 </section></div>
 <MessageEditor onOpen={selected&&searchBridge?()=>openOriginal(selected):undefined} education={education} video={selected} message={message} notes={notes} confirmed={confirmed} onEducation={changeEducation} onMessage={value => { setMessage(value); setConfirmed(false); }} onNotes={setNotes} onConfirm={setConfirmed} onGenerate={generate} onCopy={() => void copyMessage(message, confirmed, value => navigator.clipboard.writeText(value)).then(setNotice)} onSave={save}/>
 </div></main>;
}
