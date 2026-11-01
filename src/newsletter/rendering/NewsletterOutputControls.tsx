import type { TextMeasurer } from "./typography"
import { useEffect, useRef, useState } from "react"
import type { NewsletterProject } from "../schema"
import type { NewsletterDesignState } from "./designSchema"
import type { NewsletterAssetResolver } from "./assetResolution"
import { BrowserSvgRasterizer } from "../output/browserRasterizer"
import { PdfLibImageComposer } from "../output/pdfComposer"
import { generateNewsletterOutputs } from "../output/outputEngine"
import { pickNewsletterOutputTarget, saveNewsletterOutput, type OutputSelection } from "../output/storageClient"

type Props = { readonly project: NewsletterProject; readonly design: NewsletterDesignState; readonly ready: boolean; readonly blockedReason: string; readonly assetResolver?: NewsletterAssetResolver; readonly measureText?: TextMeasurer }
function outputSelection(value: string): OutputSelection { switch (value) { case "a4-png": case "a4-pdf": case "card-pngs": case "cards-pdf": return value; default: return "a4-pdf" } }
export function NewsletterOutputControls({ project, design, ready, blockedReason, assetResolver, measureText }: Props) {
  const [selection, setSelection] = useState<OutputSelection>("a4-pdf")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()
  const [failure, setFailure] = useState<string>()
  const running = useRef<AbortController | undefined>(undefined)
  useEffect(() => () => running.current?.abort(), [])
  const save = async (): Promise<void> => {
    if (!ready || busy) return
    setBusy(true); setMessage(undefined); setFailure(undefined)
    const controller = new AbortController()
    running.current = controller
    try {
      const target = await pickNewsletterOutputTarget()
      if (target === null) { setMessage("출력 폴더 선택을 취소했습니다."); return }
      const bundle = await generateNewsletterOutputs({ project, projectRevision: design.canonicalProjectRevision, design, designRevision: design.designRevision, createdAt: new Date().toISOString(), rasterizer: new BrowserSvgRasterizer(), pdfComposer: new PdfLibImageComposer(), ...(assetResolver === undefined ? {} : { assetResolver }), ...(measureText === undefined ? {} : { measureText }), signal: controller.signal })
      const outcome = await saveNewsletterOutput(target, bundle, selection, "deny")
      if (outcome.status === "succeeded") setMessage(`${target.label}에 출력물을 저장했습니다.`)
      else setFailure(`출력 저장이 완료되지 않았습니다 (${outcome.status}). 기존 파일은 덮어쓰지 않았습니다.`)
    } catch (error: unknown) { if (error instanceof Error) setFailure(error.message); else throw error }
    finally { running.current = undefined; setBusy(false) }
  }
  return <fieldset className="control-stack"><legend>PNG·PDF 출력</legend>
    <label>출력 형식<select aria-label="출력 형식" value={selection} disabled={busy} onChange={(event) => setSelection(outputSelection(event.target.value))}><option value="a4-png">A4 PNG · 2480×3508 · 1장</option><option value="a4-pdf">A4 PDF · 1페이지</option><option value="card-pngs">카드 PNG · 1800×1800 · 7장</option><option value="cards-pdf">카드 PDF · 7페이지</option></select></label>
    <button type="button" disabled={!ready || busy} onClick={() => { void save() }}>{busy ? "출력 생성·저장 중…" : "출력 폴더 선택·저장"}</button>
    {!ready && <small>출력 대기: {blockedReason}</small>}
    <small>파일 저장은 Windows 앱에서 지원합니다. 승인 대기 자산은 일반 출력할 수 없으며, 같은 이름의 기존 파일은 덮어쓰지 않습니다.</small>
    {message !== undefined && <p role="status">{message}</p>}{failure !== undefined && <p role="alert">{failure}</p>}
  </fieldset>
}
