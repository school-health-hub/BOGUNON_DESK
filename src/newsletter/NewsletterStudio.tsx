// Source: newsletter-studio 7e7336b0bf1bd8adf75710e85290e4cdfc7a8813. Electron host I/O only; design/editor/renderer remain unchanged.
import { useEffect, useMemo, useState } from "react"
import { NewsletterDesignEditor } from "./rendering/NewsletterDesignEditor"
import { addStudioAssetFiles, createStudioAssetResolver, parseStudioDocument, serializeStudioDocument, type StudioDocument } from "./studioDocument"
import "./rendering/fonts/pretendard.css"
import "./newsletter-studio.css"

export function NewsletterStudio({ onClose }: { readonly onClose: () => void }) {
  const [document, setDocument] = useState<StudioDocument>()
  const [session, setSession] = useState(0)
  const [images, setImages] = useState<ReadonlyMap<string, Uint8Array>>(new Map())
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
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
  const resolver = useMemo(() => document === undefined ? undefined : createStudioAssetResolver(document.design, images), [document?.design, images])
  const open = (value: StudioDocument): void => { setDocument(value); setImages(new Map()); setSession(value => value + 1); setMessage("문서를 열었습니다. 별도 이미지가 있으면 원본 파일을 선택해 주세요.") }
  const perform = async (operation: () => Promise<void>): Promise<void> => {
    setBusy(true)
    try { await operation() }
    catch (error: unknown) { if (error instanceof Error) setMessage(error.message); else throw error }
    finally { setBusy(false) }
  }
  return <section className="newsletter-product-host" aria-label="보건소식지 제작소">
    <header className="newsletter-file-toolbar"><button type="button" onClick={onClose}>보건 업무로</button><h1>보건소식지 제작소</h1>
      <label>원고·디자인 JSON 열기<input aria-label="원고·디자인 JSON 열기" type="file" accept=".json,application/json" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file !== undefined) void perform(async () => open(parseStudioDocument(JSON.parse(await file.text())))) }} /></label>
      <button type="button" disabled={document === undefined || busy} onClick={() => { if (document !== undefined) void perform(async () => { const result = await window.electronWork.newsletter.saveJson({json:serializeStudioDocument(document)}); if(!result.ok)throw new Error(result.error.message);setMessage(result.data.saved?"원고·디자인 JSON을 저장했습니다.":"JSON 저장을 취소했습니다."); }) }}>원고·디자인 JSON 저장</button>
      <label>이미지 원본 연결<input aria-label="이미지 원본 연결" type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={document === undefined || busy} onChange={event => { const files = [...(event.target.files ?? [])]; event.target.value = ""; if (document !== undefined) void perform(async () => { setImages(await addStudioAssetFiles(document.design, images, files)); setMessage(`${files.length}개 이미지의 SHA-256을 확인했습니다. 승인 상태는 변경하지 않았습니다.`) }) }} /></label>
    </header>
    <p>Electron 편집·미리보기 전용 · WIP 디자인은 승인된 최종 디자인이 아닙니다. PNG/PDF·기존 Tauri 원고 저장소는 연결하지 않습니다.</p>
    <p className="newsletter-file-note">JSON에는 원고·디자인·승인 상태를 보존하며 이미지 원본은 포함하지 않습니다. 다시 열 때 같은 이미지 파일을 선택하면 SHA-256으로 연결합니다.</p>
    {message.length > 0 && <p role="status">{message}</p>}
    {document === undefined ? <p className="newsletter-empty">저장한 원고·디자인 JSON을 열거나 Windows 앱의 기존 원고를 불러오세요. 원고 없이 건강정보를 자동 생성하지 않습니다.</p> : fontReady ? <NewsletterDesignEditor key={session} project={document.project} initialDesign={document.design} assetResolver={resolver} onChange={setDocument} /> : <p role="status">한글 글꼴을 준비하는 중입니다…</p>}
  </section>
}
