import {useEffect,useRef,useState} from 'react'
import type {NewsletterProject} from '../schema'
import {parseNewsletterDesignStateV2,type NewsletterDesignStateV2} from './designSchema'
import {selectedSection,editEditorialSection,updateEditorialTitle} from './editorialCopyEditing'
import {updateCardLayout} from './designState'
type Document={project:NewsletterProject;design:NewsletterDesignStateV2}
type Props=Document&{cardIndex:number;binding:string;onChange:(document:Document)=>void}
// Official text is bound to existing source copy, never a raster layer or a new
// literal field. Only an explicit user action changes the selected source.
export function OfficialElementCopy({project,design,cardIndex,binding,onChange}:Props){
 const live=useRef(true),latest=useRef({project,design});latest.current={project,design}
 useEffect(()=>{live.current=true;return()=>{live.current=false}},[])
 const card=design.cardLayouts[cardIndex]
 const topic=cardIndex-1
 const section=selectedSection(project,design.canonicalProjectRevision,topic)
 const source=section?.userEdit?.text??section?.aiGenerated.text??''
 const lines=source.split(/\r?\n/u)
 const actionLines=lines.flatMap((text,index)=>/^\s*(?:[-*•‣▪◦]|\d+[.)])\s+/u.test(text)?[index]:[])
 const action=/^action-([0-3])$/u.exec(binding)
 const preview=/^preview-([0-3])$/u.exec(binding)
 const previewTopic=preview?card?.officialTemplate?.previewTopicIndices?.[Number(preview[1])]??Number(preview[1]):undefined
 const line=action?actionLines[Number(action[1])]:undefined
 const title=/^(\d{1,2}월)\s*(.*)$/u.exec(project.title)
 const value=binding==='title'?cardIndex===0?project.title:project.topics[topic]?.title??'':binding==='month'?title?.[1]??'':binding==='title-rest'?title?.[2]??project.title:previewTopic!==undefined?project.topics[previewTopic]?.title??'':binding==='lead'?card?.editorial?.slogan??(lines[0]&&!/^\s*(?:[-*•‣▪◦]|\d+[.)])\s+/u.test(lines[0])?lines[0]:''):line!==undefined?lines[line].replace(/^\s*(?:[-*•‣▪◦]|\d+[.)])\s+/u,''):undefined
 const [draft,setDraft]=useState(value??''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 if(value===undefined)return <small>문구는 기존 원고 또는 아래 마무리 문구에 연결됩니다. 번호·강조 표시는 원고에서 계산됩니다.</small>
 const save=async()=>{setBusy(true);setError('');try{
  if(!draft.trim()||/[\r\n]/u.test(draft))throw Error('한 줄 문구를 입력해 주세요. 여러 줄 원고는 기존 원고 편집에서 수정해 주세요.')
  let next:Document={project,design}
  if(binding==='title')next.project=updateEditorialTitle(project,cardIndex===0?undefined:topic,draft)
  else if(binding==='month'||binding==='title-rest')next.project=updateEditorialTitle(project,undefined,binding==='month'?`${draft} ${title?.[2]??project.title}`:`${title?.[1]??''} ${draft}`.trim())
  else if(previewTopic!==undefined)next.project=updateEditorialTitle(project,previewTopic,draft)
  else if(binding==='lead')next.design=parseNewsletterDesignStateV2(updateCardLayout(design,{cardIndex,now:new Date().toISOString(),patch:{editorial:{layoutType:cardIndex===0?'A':'B',studentComposition:'mixed',season:'none',...card?.editorial,slogan:draft}}}))
  else if(line!==undefined){const prefix=/^(\s*(?:[-*•‣▪◦]|\d+[.)])\s+)/u.exec(lines[line])?.[1]??'';const changed=lines.map((text,index)=>index===line?prefix+draft:text).join(source.includes('\r\n')?'\r\n':'\n');next=await editEditorialSection(project,design,topic,changed,new Date().toISOString())}
  if(!live.current)return
  if(latest.current.project!==project||latest.current.design!==design)throw Error('편집 내용이 변경되었습니다. 현재 문구를 확인한 후 다시 반영해 주세요.')
  onChange(next)
 }catch(e){if(live.current)setError(e instanceof Error?e.message:'문구를 반영하지 못했습니다.')}finally{if(live.current)setBusy(false)}}
 return <fieldset><legend>선택 요소 문구</legend><label>원고 연결 문구<input aria-label="공식 요소 문구" value={draft} maxLength={1000} disabled={busy} onChange={e=>setDraft(e.target.value)}/></label><button type="button" disabled={busy||draft===value} onClick={()=>void save()}>선택 문구 반영</button>{error&&<p role="alert">{error}</p>}</fieldset>
}
