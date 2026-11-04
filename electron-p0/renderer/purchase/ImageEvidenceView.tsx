import {useEffect,useRef,useState} from 'react';
import type {ImageBox,ImageImportApi,ImagePreview,ImageSelection,ImageSource} from '../../purchase-image-protocol';
export type EvidenceRequest={sourceId:string;boxes:readonly ImageBox[]};
export function evidenceRegion(source:ImageSource,boxes:readonly ImageBox[]):ImageBox{
 if(!boxes.length)return [0,0,source.width,source.height];const left=Math.max(0,Math.floor(Math.min(...boxes.map(b=>b[0]))-24)),top=Math.max(0,Math.floor(Math.min(...boxes.map(b=>b[1]))-24));return [left,top,Math.min(source.width,Math.max(left+32,Math.ceil(Math.max(...boxes.map(b=>b[2]))+24))),Math.min(source.height,Math.max(top+32,Math.ceil(Math.max(...boxes.map(b=>b[3]))+24)))];
}
export function moveRegion(region:ImageBox,source:ImageSource,factor=1,dx=0,dy=0):ImageBox{const width=Math.min(source.width,Math.max(32,Math.round((region[2]-region[0])*factor))),height=Math.min(source.height,Math.max(32,Math.round((region[3]-region[1])*factor)));const x=Math.max(0,Math.min(source.width-width,Math.round((region[0]+region[2]-width)/2+dx*width))),y=Math.max(0,Math.min(source.height-height,Math.round((region[1]+region[3]-height)/2+dy*height)));return [x,y,x+width,y+height];}
export function ImageEvidenceView({api,selection,request,onClose}:{readonly api:ImageImportApi;readonly selection:ImageSelection;readonly request:EvidenceRequest;readonly onClose:()=>void}){
 const [preview,setPreview]=useState<ImagePreview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const generation=useRef(0),heading=useRef<HTMLHeadingElement>(null);const source=selection.sources.find(s=>s.id===request.sourceId)!;
 const load=async(region:ImageBox)=>{const token=++generation.current;setBusy(true);setError('');try{const result=await api.preview({token:selection.token,sourceId:source.id,region});if(token!==generation.current)return;if(!result.ok){setError(result.error.message);return;}if(!result.data||result.data.sourceId!==source.id){setError('원본 보기가 취소되었습니다.');return;}setPreview(result.data);}catch{if(token===generation.current)setError('원본 보기를 완료하지 못했습니다.');}finally{if(token===generation.current)setBusy(false);}};
 useEffect(()=>{setPreview(null);void load(evidenceRegion(source,request.boxes));heading.current?.focus();return()=>{generation.current++;};},[api,selection.token,request]);
 const region=preview?.region??[0,0,source.width,source.height] as ImageBox;
 return <section className="image-evidence-view" role="region" aria-label="이미지 원본 확대" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}}}>
  <header><h3 ref={heading} tabIndex={-1}>원본 보기 · 이미지 {source.order}</h3><button type="button" onClick={onClose}>원본 보기 닫기</button></header>
  <p>원본 파일은 변경하지 않습니다. 표시 영역을 Main에서 읽으며 빨간 테두리는 추출 근거입니다. 전처리 OCR 좌표도 원본 좌표로 환산합니다.</p>
  <div className="image-evidence-actions">{[['원본 전체',()=>[0,0,source.width,source.height] as ImageBox],['2배 확대',()=>moveRegion(region,source,.5)],['축소',()=>moveRegion(region,source,2)],['왼쪽',()=>moveRegion(region,source,1,-.25,0)],['오른쪽',()=>moveRegion(region,source,1,.25,0)],['위로',()=>moveRegion(region,source,1,0,-.25)],['아래로',()=>moveRegion(region,source,1,0,.25)]] .map(([label,regionFn])=><button type="button" key={label as string} disabled={busy} onClick={()=>void load((regionFn as ()=>ImageBox)())}>{label as string}</button>)}</div>
  {busy&&<p role="status">원본 영역을 읽는 중…</p>}{error&&<p role="alert">{error}</p>}
  {preview&&<svg role="img" aria-label={`이미지 ${source.order} 원본과 추출 위치`} viewBox={`${region[0]} ${region[1]} ${region[2]-region[0]} ${region[3]-region[1]}`}><image href={preview.dataUrl} x={region[0]} y={region[1]} width={region[2]-region[0]} height={region[3]-region[1]}/>{request.boxes.map((box,i)=><rect key={i} x={box[0]} y={box[1]} width={box[2]-box[0]} height={box[3]-box[1]} fill="none" stroke="#8a3f5b" strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}</svg>}
  <small>원본 좌표 {region.join(', ')} · 원본 {source.width} × {source.height}</small>
 </section>;
}
