import { useEffect, useState } from 'react';
import { ArrowLeft, Download, Library as LibraryIcon, Search, Upload } from 'lucide-react';
import { copyMessage, createMessage, filterVideos, FinderInputError, searchMockVideos, validateConditions, type Conditions, type Education, type Library, type LibraryItem, type Video } from './model';
import { libraryRepository, nativeLibrary } from './library';
import { VideoResults } from './VideoResults';
import { MessageEditor } from './MessageEditor';
import './finder.css';
const emptyEducation: Education = { educationTitle: '', target: '', schedule: '', instructions: '' };
export function EducationVideoFinder({ onClose }: {
    readonly onClose: () => void;
}) {
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
    const [busy, setBusy] = useState(false);
    const reportError = (error: unknown): void => { setNotice(error instanceof FinderInputError ? error.message : '로컬 라이브러리 작업을 완료하지 못했습니다. 기존 데이터를 유지하고 백업 복구를 시도해 주세요.'); };
    useEffect(() => { void libraryRepository.load().then(result => { setLibrary(result.library); if (result.recovered)
        setNotice('손상된 저장소 대신 백업을 불러왔습니다.'); }).catch(reportError); }, []);
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
    const search = () => { const error = validateConditions(conditions); if (error) {
        setNotice(error);
        return;
    } setSearched({ ...conditions }); setVideos(searchMockVideos(conditions)); setWindow(3); setNotice('합성 Mock 결과 12개입니다. 실제 YouTube를 검색하지 않았습니다.'); };
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
    const exportLibrary = () => void run(async () => { const json = await libraryRepository.export(); const url = URL.createObjectURL(new Blob([json], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'education-video-library-v1.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('라이브러리를 내보냈습니다.'); });
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
 </div><span className="ev-mock-badge">합성 Mock 전용</span></header>
 <div className="ev-mock-note"><strong>실제 YouTube 검색 결과가 아닙니다.</strong>
 모든 제목·채널·영상 ID·공식 채널 예시는 합성 데이터입니다. 링크는 실제 영상으로 확인되지 않았으며, 안내문에도 Mock 표시가 포함됩니다.</div>
 <section className="ev-search" aria-labelledby="ev-search-heading">
 <div className="ev-section-heading"><div><span className="ev-step">01</span><h2 id="ev-search-heading">교육 조건</h2></div></div>
 <form onSubmit={e => { e.preventDefault(); search(); }}>
 <label>교육 주제<input maxLength={100} value={conditions.topic} placeholder="예: 손씻기와 감염병 예방" onChange={e => setConditions({ ...conditions, topic: e.target.value })}/></label>
 <label>검색 대상<input maxLength={100} value={conditions.target} placeholder="예: 초등학교 3~4학년" onChange={e => setConditions({ ...conditions, target: e.target.value })}/></label>
 <label>희망 영상 길이(분)<input type="number" min={1} max={180} value={conditions.minutes} onChange={e => setConditions({ ...conditions, minutes: Number(e.target.value) })}/></label>
 <button className="ev-primary" type="submit"><Search size={17}/>Mock 영상 검색</button>
 </form></section>
 <p role="status" className="ev-notice">{notice || '검색과 안내문 생성은 외부 API 없이 동작합니다.'}</p>
 <div className="ev-layout"><div>
 <div className="ev-filters" aria-label="영상 길이 범위">
 {[{ value: 3, label: '희망 길이 ±3분' }, { value: 5, label: '±5분' }, { value: null, label: '전체 보기 (12개)' }].map(option => <button type="button" key={option.label} aria-pressed={windowMinutes === option.value} onClick={() => setWindow(option.value)}>{option.label}</button>)}<span>가까운 길이순</span>
 </div>
 <VideoResults videos={shown} total={videos.length} selected={selected} onSelect={choose}/>
 <section className="ev-library" aria-labelledby="ev-library-heading">
 <div className="ev-section-heading"><div><LibraryIcon size={20}/><h2 id="ev-library-heading">내 로컬 라이브러리</h2></div><span>{library.items.length}개</span></div>
 <p className="ev-muted">{nativeLibrary ? '이 PC의 education-video 전용 JSON 저장소에 보관합니다.' : '브라우저 QA 모드: 이 브라우저의 localStorage만 사용합니다. 네이티브 파일 저장·복구 보장이 아닙니다.'}</p>
 <div className="ev-actions">
 <button type="button" disabled={busy} onClick={exportLibrary}><Download size={16}/>내보내기</button>
 <label className="ev-import"><Upload size={16}/>가져오기<input type="file" accept=".json,application/json" disabled={busy} onChange={e => { importLibrary(e.target.files?.[0]); e.target.value = ''; }}/></label>
 <button type="button" disabled={busy} onClick={() => void run(async () => { const result = await libraryRepository.recover(); setLibrary(result.library); setNotice('백업에서 복구했습니다.'); })}>백업 복구</button>
 </div>
 {library.items.length === 0 ? <p className="ev-empty-inline">저장한 영상이 없습니다. 안내문을 작성한 뒤 저장해 주세요.</p> : <ul>{library.items.map(item => <li key={item.videoId}><div><strong>{item.educationTitle || item.title}</strong><p>{item.schedule} · {item.target}</p></div><button type="button" onClick={() => loadItem(item)}>불러오기</button></li>)}</ul>}
 </section></div>
 <MessageEditor education={education} video={selected} message={message} notes={notes} confirmed={confirmed} onEducation={changeEducation} onMessage={value => { setMessage(value); setConfirmed(false); }} onNotes={setNotes} onConfirm={setConfirmed} onGenerate={generate} onCopy={() => void copyMessage(message, confirmed, value => navigator.clipboard.writeText(value)).then(setNotice)} onSave={save}/>
 </div></main>;
}
