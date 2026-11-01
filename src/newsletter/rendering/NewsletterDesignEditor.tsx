import { NewsletterOutputControls } from "./NewsletterOutputControls"
import { NewsletterEditorialControls } from "./NewsletterEditorialControls"
import { NewsletterEditorialCopy } from "./NewsletterEditorialCopy"
import { editorialActionCount } from "./editorialCopyEditing"
import { useEffect, useMemo, useRef, useState } from "react"
import type { NewsletterProject } from "../schema"
import { NewsletterDesignControls } from "./NewsletterDesignControls"
import { restoreDesignRevision, upgradeNewsletterDesignStateV2 } from "./designState"
import type { NewsletterDesignState, NewsletterDesignStateV2, NewsletterDesignStateV1 } from "./designSchema"
import { A4Preview, CardPreview } from "./NewsletterPreview"
import { compileRenderDocument } from "./renderDocument"
import type { TextMeasurer } from "./typography"
import { attachApprovedMascot, OTTER_ASSET_ID } from "./bundledMascot"
import { useNewsletterAssets } from "./useNewsletterAssets"
import { mascotQualityWarnings } from "./mascotQuality"
import { assetExportPending, referencedDesignAssets, type NewsletterAssetResolver } from "./assetResolution"

type EditorProps = { readonly project: NewsletterProject; readonly initialDesign: NewsletterDesignState; readonly assetResolver?: NewsletterAssetResolver; readonly onChange?: (value: { readonly project: NewsletterProject; readonly design: NewsletterDesignState }) => void }

function useTextMeasurer(): TextMeasurer {
  return useMemo<TextMeasurer>(() => {
    if (typeof CanvasRenderingContext2D === "undefined") return (text, style) => style.fontSize * [...text].length
    const context = document.createElement("canvas").getContext("2d")
    return (text, style) => {
      if (context === null) return style.fontSize * [...text].length
      context.font = `${style.fontWeight} ${style.fontSize}px Pretendard`
      return context.measureText(text).width
    }
  }, [])
}

export function NewsletterDesignEditor({ project: initialProject, initialDesign, assetResolver, onChange }: EditorProps) {
  const [baselineInput] = useState({ project: initialProject, design: initialDesign })
  const [project, setProject] = useState(initialProject)
  const changeListener = useRef(onChange)
  changeListener.current = onChange
  const [design, setDesign] = useState(initialDesign)
  const published = useRef({ project, design })
  useEffect(() => { if (published.current.project === project && published.current.design === design) return; published.current = { project, design }; changeListener.current?.({ project, design }) }, [project, design])
  const [selectedCard, setSelectedCard] = useState(0)
  const [selectedModule, setSelectedModule] = useState(0)
  const [mode, setMode] = useState<"a4" | "cards">("a4")
  const [compare, setCompare] = useState(false)
  const [upgradeCandidate, setUpgradeCandidate] = useState<NewsletterDesignStateV2>()
  const measureText = useTextMeasurer()
  const currentAssets = useNewsletterAssets(design, assetResolver)
  const baselineAssets = useNewsletterAssets(baselineInput.design, assetResolver)
  const upgradeAssets = useNewsletterAssets(upgradeCandidate ?? design, assetResolver)
  const [assetError, setAssetError] = useState<string>()
  const current = useMemo(() => compileRenderDocument({ project, projectRevision: design.canonicalProjectRevision, design, designRevision: design.designRevision, measureText }), [design, measureText, project])
  const baseline = useMemo(() => compileRenderDocument({ project: baselineInput.project, projectRevision: baselineInput.design.canonicalProjectRevision, design: baselineInput.design, designRevision: baselineInput.design.designRevision, measureText }), [baselineInput, measureText])
  const upgradePreview = useMemo(() => upgradeCandidate === undefined ? undefined : compileRenderDocument({ project, projectRevision: upgradeCandidate.canonicalProjectRevision, design: upgradeCandidate, designRevision: upgradeCandidate.designRevision, measureText }), [measureText, project, upgradeCandidate])
  const warnings = mascotQualityWarnings(current)
  const exportPending = referencedDesignAssets(design, design.designRevision).some(assetExportPending)
  const outputReady = currentAssets.status === "ready" && current.issues.length === 0 && !exportPending
  const outputStatus = currentAssets.status === "error" ? "이미지 검증 실패 · 출력 차단" : currentAssets.status === "loading" ? "이미지 검증 중 · 출력 대기" : current.issues.length > 0 ? `${current.issues.length}개 수정 필요` : exportPending ? "렌더 승인 · 출력 승인 대기" : "출력 가능"
  const mascotAttached = design.designSchemaVersion === 2 && design.a4Layout.brand?.mascot.assetId === OTTER_ASSET_ID && design.cardLayouts.every((layout) => layout.brand?.mascot.assetId === OTTER_ASSET_ID)
  const card = current.cards[selectedCard] ?? current.cards[0]
  if (card === undefined) return <main role="alert">카드 레이아웃을 불러올 수 없습니다.</main>

  const requestUpgrade = (): void => setUpgradeCandidate(upgradeNewsletterDesignStateV2(design as NewsletterDesignStateV1, new Date().toISOString()))
  const confirmUpgrade = (): void => {
    if (upgradeCandidate === undefined) return
    setDesign(upgradeCandidate)
    setUpgradeCandidate(undefined)
    setCompare(true)
  }

  const attachMascot = (): void => {
    if (design.designSchemaVersion !== 2) return
    try { setDesign(attachApprovedMascot(design, new Date().toISOString())); setAssetError(undefined) }
    catch (error: unknown) { if (error instanceof Error) setAssetError(error.message); else throw error }
  }
  return <main className="newsletter-studio">
    <header className="studio-header"><div><span className="eyebrow">NEWSLETTER STUDIO · NS-3E</span><h1>보건소식지 디자인 편집기</h1><p>동일한 Scene으로 A4와 카드뉴스를 미리보고 출력합니다.</p></div><div className="revision-summary"><span className="schema-chip">Design V{design.designSchemaVersion}</span><span className="revision-chip">Revision <strong>{design.designRevision}</strong></span></div></header>
    <nav className="mode-tabs" aria-label="미리보기 종류"><button type="button" aria-pressed={mode === "a4"} onClick={() => setMode("a4")}>A4 1장</button><button type="button" aria-pressed={mode === "cards"} onClick={() => setMode("cards")}>카드뉴스 7장</button><button type="button" aria-pressed={compare} onClick={() => setCompare((value) => !value)}>변경 전후 비교</button></nav>
    <section className="studio-body">
      <aside className="editor-panel" aria-label="디자인 편집기">
        <div className="panel-heading"><span>DESIGN SIDECAR</span><h2>디자인 설정</h2></div>
        {design.designSchemaVersion === 1 ? <section className="upgrade-card"><span className="upgrade-kicker">V2 LAYOUT AVAILABLE</span><h3>겹침 없는 구조형 레이아웃</h3><p>6개 A4 모듈과 7개 카드에 lead·목록·삽화·마무리 프레임을 분리합니다. 원고와 기존 revision은 그대로 보존됩니다.</p><ul><li>Canonical revision {design.canonicalProjectRevision} 변경 없음</li><li>기존 revision {design.revisionHistory.length}개 보존</li><li>확인 후에만 새 revision 생성</li></ul><button type="button" className="primary-action" onClick={requestUpgrade}>V2 디자인 검토</button></section> : <>
          <section className="selection-block"><span className="control-label">{mode === "a4" ? "편집할 A4 주제" : "편집할 카드"}</span><div className={mode === "a4" ? "module-picker" : "card-picker"} aria-label={mode === "a4" ? "A4 주제 선택" : "카드 선택"}>{(mode === "a4" ? current.a4.modules : current.cards).map((item, index) => <button type="button" key={"moduleId" in item ? item.moduleId : item.pageId} aria-pressed={(mode === "a4" ? selectedModule : selectedCard) === index} onClick={() => mode === "a4" ? setSelectedModule(index) : setSelectedCard(index)}>{mode === "a4" ? `${index + 1}` : index === 0 ? "표지" : `${index}`}</button>)}</div></section>
          <NewsletterEditorialCopy key={`${mode}-${selectedModule}-${selectedCard}-${design.canonicalProjectRevision}`} project={project} design={design} {...(mode === "cards" && selectedCard === 0 ? {} : { topicIndex: mode === "a4" ? selectedModule : selectedCard - 1 })} onChange={(value) => { setProject(value.project); setDesign(value.design) }} />
          {mode === "cards" && <NewsletterEditorialControls design={design} cardIndex={selectedCard} actionCount={editorialActionCount(project, design.canonicalProjectRevision, selectedCard - 1)} onChange={setDesign} />}
          <NewsletterDesignControls design={design} mode={mode} selectedIndex={mode === "a4" ? selectedModule : selectedCard} onChange={setDesign} />
          <div className="asset-status"><strong>수달쌤 기본형 v1</strong><span>{mascotAttached ? exportPending ? "디자인·렌더 승인 · 실제 출력 승인 대기" : "디자인·렌더 승인 · 출력 승인됨" : "승인된 기본형을 A4·표지·본문에 함께 적용합니다."}</span><button type="button" onClick={attachMascot} disabled={mascotAttached}>승인 수달쌤 적용</button>{assetError !== undefined && <span role="alert">{assetError}</span>}</div>
        </>}
        <NewsletterOutputControls project={project} design={design} measureText={measureText} ready={outputReady} blockedReason={outputStatus} {...(assetResolver === undefined ? {} : { assetResolver })} />
        <label>Revision 복원<select aria-label="Revision 복원" value="" onChange={(event) => { if (event.target.value !== "") setDesign((previous) => restoreDesignRevision(previous, { revision: Number(event.target.value), now: new Date().toISOString() })) }}><option value="">복원할 revision 선택</option>{design.revisionHistory.slice(0, -1).map((entry) => <option key={entry.revision} value={entry.revision}>Revision {entry.revision}</option>)}</select></label>
      </aside>
      <section className="preview-panel">
        <div className="preview-toolbar"><div><span className="preview-kicker">LIVE SCENE</span><h2>{mode === "a4" ? "A4 보건소식지" : selectedCard === 0 ? "카드뉴스 표지" : `주제 카드 ${selectedCard}`}</h2></div><span className={outputReady ? "status-pill valid" : "status-pill invalid"}>{outputStatus}</span></div>
        <div className={compare ? "preview-grid compare" : "preview-grid"}>{compare && <article><div className="preview-caption"><span>BEFORE</span><strong>Revision {baselineInput.design.designRevision}</strong></div>{baselineAssets.status === "ready" ? mode === "a4" ? <A4Preview document={baseline} assets={baselineAssets.assets} /> : <CardPreview page={baseline.cards[selectedCard] ?? baseline.cards[0] ?? card} assets={baselineAssets.assets} /> : <p role="status">{baselineAssets.status === "error" ? baselineAssets.message : "원본 이미지 검증 중…"}</p>}</article>}<article><div className="preview-caption"><span>CURRENT</span><strong>Revision {design.designRevision}</strong></div>{currentAssets.status === "ready" ? mode === "a4" ? <A4Preview document={current} assets={currentAssets.assets} /> : <CardPreview page={card} assets={currentAssets.assets} /> : <p role={currentAssets.status === "error" ? "alert" : "status"}>{currentAssets.status === "error" ? currentAssets.message : "이미지 SHA-256 검증 중…"}</p>}</article></div>
        {warnings.length > 0 && <ul aria-label="이미지 해상도 경고">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
        <section className={current.issues.length === 0 ? "validation-panel valid" : "validation-panel invalid"} aria-live="polite"><h2>조판 검증</h2>{current.issues.length === 0 ? <p>Scene 충돌, overflow, 누락 텍스트가 없습니다.</p> : <ul>{current.issues.map((issue) => <li key={`${issue.pageId}-${issue.blockId}-${issue.kind}`}><strong>{issue.pageId}</strong> · {issue.message}</li>)}</ul>}</section>
      </section>
    </section>
    {upgradeCandidate !== undefined && upgradePreview !== undefined && <div className="upgrade-dialog-backdrop" role="presentation"><section className="upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="upgrade-title"><div className="dialog-copy"><span className="upgrade-kicker">EXPLICIT UPGRADE</span><h2 id="upgrade-title">V2 디자인으로 전환할까요?</h2><p>원고는 바뀌지 않으며 V1 snapshot이 revision history에 남습니다. 아래 비교는 전환 전과 새 구조형 A4입니다.</p></div><div className="upgrade-comparison"><article><span>V1 · 현재</span>{currentAssets.status === "ready" && <A4Preview document={current} assets={currentAssets.assets} />}</article><article><span>V2 · 전환 예정</span>{upgradeAssets.status === "ready" && <A4Preview document={upgradePreview} assets={upgradeAssets.assets} />}</article></div><div className="dialog-actions"><button type="button" onClick={() => setUpgradeCandidate(undefined)}>취소</button><button type="button" className="primary-action" onClick={confirmUpgrade}>V2로 전환</button></div></section></div>}
  </main>
}
