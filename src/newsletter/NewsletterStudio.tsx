// Source: newsletter-studio 7e7336b0bf1bd8adf75710e85290e4cdfc7a8813. Electron host I/O only; design/editor/renderer remain unchanged.
import {NewsletterProjectControls} from "../../electron-p0/renderer/adapters/NewsletterProjectControls"
import type {NewsletterHead,NewsletterPreview,NewsletterProjectRecord} from "../../electron-p0/protocol"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { NewsletterDesignEditor } from "./rendering/NewsletterDesignEditor"
import { addStudioAssetFiles, createStudioAssetResolver, parseStudioDocument, serializeStudioDocument, type StudioDocument } from "./studioDocument"
import "./rendering/fonts/pretendard.css"
import {createBlankNewsletter,newsletterSchoolTypes,type NewsletterSchoolType} from "./newDocument"
import "./newsletter-studio.css"

export function NewsletterStudio({ onClose,renderAiTools }: { readonly onClose: () => void;readonly renderAiTools?:(text:string)=>ReactNode }) {
  const [creating,setCreating]=useState(false)
  const [month,setMonth]=useState(()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`})
  const [schoolType,setSchoolType]=useState<NewsletterSchoolType>('coed-high')
  type Draft={key:number;document:StudioDocument;head:NewsletterHead|null;images:ReadonlyMap<string,Uint8Array>}
  const [drafts,setDrafts]=useState<readonly Draft[]>([])
  const [draftKey,setDraftKey]=useState('')
  const draftSequence=useRef(0)
  const [head,setHead]=useState<NewsletterHead|null>(null)
  const [preview,setPreview]=useState<NewsletterPreview|null>(null)
  const [document, setDocument] = useState<StudioDocument>()
  const [session, setSession] = useState(0)
  const [images, setImages] = useState<ReadonlyMap<string, Uint8Array>>(new Map())
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [projectBusy,setProjectBusy]=useState(false)
  const [fontReady, setFontReady] = useState(typeof window.document.fonts === "undefined")
  useEffect(() => {
    if (window.document.fonts === undefined) return
    let active = true
    void window.document.fonts.load("400 16px Pretendard", "한글 보건소식").then(fonts => {
      if (!active) return
      if (fonts.length === 0) setMessage("한글 글꼴을 불러오지 못했습니다. 편집기를 다시 열어 주세요.")
      else setFontReady(true)
    }, (error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "한글 글꼴을 불러오지 못했습니다.") })
    return () => { active = false }
  }, [])
  const shown=preview===null?document:parseStudioDocument(JSON.parse(preview.document))
  const resolver = useMemo(() => shown === undefined ? undefined : createStudioAssetResolver(shown.design, images), [shown?.design, images])
  const archive=():Draft|undefined=>document===undefined?undefined:{key:++draftSequence.current,document,head,images}
  const open = (value: StudioDocument): void => { const previous=archive();if(previous)setDrafts(current=>[...current,previous]);setHead(null);setPreview(null);setDocument(value); setImages(new Map()); setSession(value => value + 1); setMessage("문서를 열었습니다. 별도 이미지가 있으면 원본 파일을 선택해 주세요.") }
  const loaded=(record:NewsletterProjectRecord):void=>{open(parseStudioDocument(JSON.parse(record.document)));setHead(record.head)}
  const stored=(record:NewsletterProjectRecord):void=>{setDocument(parseStudioDocument(JSON.parse(record.document)));setSession(value=>value+1);setHead(record.head)}
  const perform = async (operation: () => Promise<void>): Promise<void> => {
    setBusy(true)
    try { await operation() }
    catch (error: unknown) { if (error instanceof Error) setMessage(error.message); else throw error }
    finally { setBusy(false) }
  }
  const startNew=()=>void perform(async()=>{
    const value=await createBlankNewsletter({month,schoolType,projectId:`newsletter-${crypto.randomUUID()}`,now:new Date().toISOString()})
    open(value);setCreating(false);setMessage(document?'새 소식지를 만들었습니다. 주제와 원고는 직접 작성해 주세요. 이전 작업은 임시 보관했습니다.':'새 소식지를 만들었습니다. 주제와 원고는 직접 작성해 주세요.')
  })
  const reopenDraft=()=>void perform(async()=>{
    const selected=drafts.find(value=>String(value.key)===draftKey);if(!selected)throw Error('임시 보관 작업을 선택해 주세요.')
    const parsed=parseStudioDocument(selected.document),previous=archive()
    setDrafts(current=>[...current.filter(value=>value.key!==selected.key),...(previous?[previous]:[])])
    setDocument(parsed);setHead(selected.head);setImages(selected.images);setPreview(null);setSession(value=>value+1);setDraftKey('');setMessage('임시 보관한 원고와 이미지 연결을 다시 열었습니다.')
  })
  return <section className="newsletter-product-host" aria-label="보건소식지 제작소">
    <header className="newsletter-file-toolbar"><div className="newsletter-title-group"><button type="button" disabled={busy||projectBusy} onClick={()=>{setCreating(false);onClose()}}>보건 업무로</button><div><span>문서 편집·미리보기·출력</span><h1>보건소식지 제작소</h1></div></div><div className="newsletter-file-actions"><button type="button" className="newsletter-primary-action" disabled={busy||projectBusy||creating||preview!==null} onClick={()=>setCreating(true)}>새 소식지 작성</button>
      <label>JSON 열기<input aria-label="원고·디자인 JSON 열기" type="file" accept=".json,application/json" disabled={busy||projectBusy||creating||preview!==null} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file !== undefined) void perform(async () => open(parseStudioDocument(JSON.parse(await file.text())))) }} /></label>
      <button type="button" disabled={document === undefined || busy || projectBusy || creating || preview!==null} onClick={() => { if (document !== undefined) void perform(async () => { const result = await window.electronWork.newsletter.saveJson({json:serializeStudioDocument(document)}); if(!result.ok)throw new Error(result.error.message);setMessage(result.data.saved?"원고·디자인 JSON을 저장했습니다.":"JSON 저장을 취소했습니다."); }) }}>원고·디자인 JSON 저장</button>
      <label>이미지 연결<input aria-label="이미지 원본 연결" type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={document === undefined || busy || projectBusy || creating || preview!==null} onChange={event => { const files = [...(event.target.files ?? [])]; event.target.value = ""; if (document !== undefined) void perform(async () => { setImages(await addStudioAssetFiles(document.design, images, files)); setMessage(`${files.length}개 이미지의 SHA-256을 확인했습니다. 승인 상태는 변경하지 않았습니다.`) }) }} /></label></div>
    </header>
    {renderAiTools?.(shown===undefined?'':shown.project.title+'\n\n'+shown.project.canonicalCopy.sections.map(section=>section.userEdit?.text??section.aiGenerated.text).join('\n\n'))}
    {creating&&<form className="newsletter-file-toolbar" aria-label="새 소식지 작성" onSubmit={event=>{event.preventDefault();if(!busy&&!projectBusy)startNew()}}>
      <label>작성 월<input aria-label="작성 월" type="month" required value={month} disabled={busy||projectBusy} onChange={event=>setMonth(event.target.value)}/></label>
      <label>학교 유형<select aria-label="학교 유형" value={schoolType} disabled={busy||projectBusy} onChange={event=>setSchoolType(event.target.value as NewsletterSchoolType)}>{Object.entries(newsletterSchoolTypes).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <p>본문 자동 생성 없이 빈 6개 주제로 시작합니다. 현재 원고·이미지·저장 revision은 임시 보관하며 기존 파일은 변경하지 않습니다.</p>
      <button type="submit" disabled={busy||projectBusy}>새 소식지 만들기</button><button type="button" disabled={busy||projectBusy} onClick={()=>setCreating(false)}>새 작성 취소</button>
    </form>}
    {drafts.length>0&&<div className="newsletter-file-toolbar"><label>임시 보관 작업<select aria-label="임시 보관 작업" value={draftKey} disabled={busy||projectBusy||creating||preview!==null} onChange={event=>setDraftKey(event.target.value)}><option value="">작업 선택</option>{drafts.map(value=><option key={value.key} value={value.key}>{value.document.project.title} · 임시 {value.key}</option>)}</select></label><button type="button" disabled={!draftKey||busy||projectBusy||creating||preview!==null} onClick={reopenDraft}>임시 작업 다시 열기</button></div>}
    <p className="newsletter-file-note">임시 보관은 앱 실행 중에만 유지됩니다. 종료 전 JSON 또는 프로젝트에 저장해 주세요.</p>
    <div inert={busy||creating}>
    <NewsletterProjectControls onBusyChange={setProjectBusy} document={document} head={head} onLoaded={loaded} onSaved={stored} onPreview={setPreview}/>
    </div>
    {preview!==null&&<p role="status">이전 revision 미리보기입니다. 복구를 확인하기 전에는 현재 원고가 변경되지 않습니다. 이미지는 복구 후 다시 연결해 주세요.</p>}
    <details className="newsletter-safeguards"><summary>저장·출력 안전 안내</summary><p>Electron 편집·미리보기 전용 · WIP 디자인은 승인된 최종 디자인이 아닙니다. PNG/PDF는 독립 검증 후 저장하며 기존 Tauri 원고 저장소는 연결하지 않습니다.</p><p>JSON에는 원고·디자인·승인 상태를 보존하며 이미지 원본은 포함하지 않습니다. 다시 열 때 같은 이미지 파일을 선택하면 SHA-256으로 연결합니다.</p></details>
    {message.length > 0 && <p role="status">{message}</p>}
    {shown === undefined ? <p className="newsletter-empty">원고·디자인 JSON을 열거나 새 소식지를 작성하거나 Electron 저장 프로젝트를 선택해 불러오세요. 원고 없이 건강정보를 자동 생성하지 않습니다.</p> : fontReady ? <div inert={preview!==null||creating||busy||projectBusy}><NewsletterDesignEditor key={preview?.token??session} project={shown.project} initialDesign={shown.design} assetResolver={resolver} onChange={value=>{if(preview===null)setDocument(value)}} /></div> : <p role="status">한글 글꼴을 준비하는 중입니다…</p>}
  </section>
}
