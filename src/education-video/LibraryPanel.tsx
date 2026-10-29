import {Download,Library as LibraryIcon,Upload} from 'lucide-react';
import {nativeLibrary} from './library';
import {LibraryEntrySummary} from './LibraryEntrySummary';
import type {LibraryEntry,LibraryV2} from './libraryV2';
type Props={readonly library:LibraryV2;readonly busy:boolean;readonly onExport:()=>void;readonly onImport:(file:File|undefined)=>void;readonly onRecover:()=>void;readonly onLoad:(entry:LibraryEntry)=>void;readonly onDelete:(id:string)=>void;readonly onRefresh:(id:string)=>void};
export function LibraryPanel(p:Props){return <section className="ev-library" aria-labelledby="ev-library-heading">
 <div className="ev-section-heading"><div><LibraryIcon size={20}/><h2 id="ev-library-heading">내 로컬 라이브러리</h2></div><span>{p.library.entries.length}개</span></div>
 <p className="ev-muted">{nativeLibrary?'이 PC의 education-video 전용 JSON 저장소에 보관합니다.':'브라우저 QA 모드: 이 브라우저의 localStorage만 사용합니다. 네이티브 파일 저장·복구 보장이 아닙니다.'}</p>
 <p className="ev-muted">영상 메타데이터는 최대 30일 보관합니다. 만료·삭제 후에도 교사 메모와 수정 안내문은 유지됩니다.</p>
 <div className="ev-actions"><button type="button" disabled={p.busy} onClick={p.onExport}><Download size={16}/>내보내기</button>
 <label className="ev-import"><Upload size={16}/>가져오기<input type="file" accept=".json,application/json" disabled={p.busy} onChange={e=>{p.onImport(e.target.files?.[0]);e.target.value='';}}/></label>
 <button type="button" disabled={p.busy} onClick={p.onRecover}>백업 복구</button></div>
 {p.library.entries.length===0?<p className="ev-empty-inline">저장한 영상이 없습니다. 안내문을 작성한 뒤 저장해 주세요.</p>:<ul>{p.library.entries.map(entry=><li key={entry.videoId}>
 <div><LibraryEntrySummary entry={entry}/><p>{entry.teacher.schedule} · {entry.teacher.target}</p>
 <small>{entry.ai?`AI 검색 출처 · 원문 확인 필요 · 확인일 ${entry.ai.checkedAt.slice(0,10)}`:entry.provider?`${entry.provider.synthetic?'합성 Mock':'YouTube 메타데이터'} · 유효기간 ${entry.provider.expiresAt.slice(0,10)}`:'메타데이터 만료 또는 삭제 · 교사 자료 보존'}</small></div>
 <div className="ev-actions"><button type="button" onClick={()=>p.onLoad(entry)}>불러오기</button><button type="button" disabled={p.busy} onClick={()=>p.onRefresh(entry.videoId)}>현재 결과로 메타데이터 갱신</button><button type="button" disabled={p.busy||(entry.provider===null&&!entry.ai)} onClick={()=>p.onDelete(entry.videoId)}>메타데이터 삭제</button></div>
 </li>)}</ul>}
 </section>;}
