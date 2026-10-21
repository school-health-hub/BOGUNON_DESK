import {Check,Play,ShieldCheck} from 'lucide-react';
import {formatDuration,officialEvidence,type Video} from './model';
import {verifiedChannelEvidence,verifiedChannels} from './officialChannels';
type Props={readonly videos:readonly Video[];readonly selected:Video|null;readonly onSelect:(video:Video)=>void;readonly total:number;readonly hasSearched?:boolean};
export function VideoResults({videos,selected,onSelect,total,hasSearched=false}:Props){return <section aria-labelledby="ev-results">
 <div className="ev-section-heading"><div><span className="ev-step">02</span><h2 id="ev-results">영상 비교·선택</h2></div><span>{videos.length} / {total}개</span></div>
 <p className="ev-muted">공식 채널 표시도 교육 적합성을 보장하지 않습니다. 교사가 내용을 확인해 주세요.</p>
 {!total&&<div className="ev-empty"><Play size={28}/><h3>{hasSearched?'검색 결과가 없습니다':'교육에 맞는 영상을 찾아보세요'}</h3><p>{hasSearched?'조건을 변경하거나 로컬 Mock으로 확인해 주세요.':'조건을 입력하고 Mock 검색을 실행하면 합성 결과 12개를 비교할 수 있습니다.'}</p></div>}
 {total>0&&!videos.length&&<p role="status">조건에 맞는 결과가 없습니다. ±5분 또는 전체 보기로 확장해 주세요. 길이 미확인은 전체 보기에서만 표시합니다.</p>}
 <div className="ev-results">{videos.map((video,index)=>{
 const synthetic=video.source!=='live';const registration=synthetic?undefined:verifiedChannels.get(video.channelId);const evidence=synthetic?officialEvidence(video.channelId):verifiedChannelEvidence(video.channelId);
 return <article key={video.videoId} className={`ev-result ${selected?.videoId===video.videoId?'is-selected':''}`}>
 <div className="ev-video-number"><Play size={17}/><span>{String(index+1).padStart(2,'0')}</span></div>
 <div className="ev-result-body"><span className="ev-muted">{synthetic?'합성 Mock':'영상 메타데이터'} · {formatDuration(video.durationSeconds)}</span><h3>{video.title}</h3><p>{video.channelTitle}</p>
 <p className="ev-channel">{evidence?<><ShieldCheck size={14}/>{synthetic?'합성 레지스트리 일치 · 실제 공식 채널 아님':'검증된 공식 채널 · 교육 적합성은 교사 확인'}</>:'미검증 · 공식 표시 없음'}</p>
 {evidence&&<details><summary>확인 근거</summary><p>{evidence}</p>{registration&&<p>{registration.name} · 확인일 {registration.checkedAt} · {registration.reviewStatus}<br/>{registration.channelUrl}</p>}<code>{video.channelId}</code></details>}
 <code className="ev-url">{video.url}</code><small>{synthetic?'합성 fixture URL · 실제 영상 존재 여부 미확인':`조회 시각: ${video.fetchedAt??'확인되지 않음'}`}</small>
 </div><button type="button" aria-label={`${video.title} 선택`} aria-pressed={selected?.videoId===video.videoId} onClick={()=>onSelect(video)}>{selected?.videoId===video.videoId?<><Check size={15}/>선택됨</>:'영상 선택'}</button>
 </article>;})}</div></section>;}
