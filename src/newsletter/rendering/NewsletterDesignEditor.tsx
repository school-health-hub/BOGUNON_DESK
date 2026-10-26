import { useMemo, useState } from "react"
import { updateCardLayout, restoreDesignRevision } from "./designState"
import type { NewsletterDesignState } from "./designSchema"
import { compileRenderDocument } from "./renderDocument"
import type { NewsletterProject } from "../schema"
import { A4Preview, CardPreview } from "./NewsletterPreview"
import type { TextMeasurer } from "./typography"

type EditorProps = {
  readonly project: NewsletterProject
  readonly initialDesign: NewsletterDesignState
}

export function NewsletterDesignEditor({ project, initialDesign }: EditorProps) {
  const [design, setDesign] = useState(initialDesign)
  const [selectedCard, setSelectedCard] = useState(0)
  const [mode, setMode] = useState<"a4" | "cards">("a4")
  const [compare, setCompare] = useState(false)
  const measureText = useMemo<TextMeasurer>(() => {
    if (typeof CanvasRenderingContext2D === "undefined") return (text, style) => style.fontSize * [...text].length
    const context = document.createElement("canvas").getContext("2d")
    return (text, style) => {
      if (context === null) return style.fontSize * [...text].length
      context.font = `${style.fontWeight} ${style.fontSize}px Pretendard`
      return context.measureText(text).width
    }
  }, [])
  const current = useMemo(() => compileRenderDocument({ project, projectRevision: design.canonicalProjectRevision, design, designRevision: design.designRevision, measureText }), [design, measureText, project])
  const baseline = useMemo(() => compileRenderDocument({ project, projectRevision: initialDesign.canonicalProjectRevision, design: initialDesign, designRevision: 1, measureText }), [initialDesign, measureText, project])
  const layout = design.cardLayouts[selectedCard]
  const card = current.cards[selectedCard]

  if (layout === undefined || card === undefined) return <main role="alert">카드 레이아웃을 불러올 수 없습니다.</main>

  const changeCard = (patch: Parameters<typeof updateCardLayout>[1]["patch"]): void => {
    setDesign((previous) => updateCardLayout(previous, { cardIndex: selectedCard, patch, now: new Date().toISOString() }))
  }

  return <main className="newsletter-studio">
    <header className="studio-header">
      <div><span className="eyebrow">NEWSLETTER STUDIO · NS-3A QA</span><h1>보건소식지 디자인 렌더러</h1><p>합성 데이터와 미승인 자산 placeholder만 사용하는 독립 검증 화면입니다.</p></div>
      <div className="revision-chip">Design revision <strong>{design.designRevision}</strong></div>
    </header>

    <nav className="mode-tabs" aria-label="미리보기 종류">
      <button type="button" aria-pressed={mode === "a4"} onClick={() => setMode("a4")}>A4 1장</button>
      <button type="button" aria-pressed={mode === "cards"} onClick={() => setMode("cards")}>카드뉴스 7장</button>
      <button type="button" aria-pressed={compare} onClick={() => setCompare((value) => !value)}>변경 전후 비교</button>
    </nav>

    <section className="studio-body">
      <aside className="editor-panel" aria-label="디자인 편집기">
        <h2>디자인 설정</h2>
        {mode === "cards" && <div className="card-picker" aria-label="카드 선택">{current.cards.map((item, index) => <button type="button" key={item.pageId} aria-pressed={selectedCard === index} onClick={() => setSelectedCard(index)}>{index === 0 ? "표지" : `${index}번`}</button>)}</div>}
        <label>배경색<input aria-label="배경색" type="color" value={layout.background} onChange={(event) => changeCard({ background: event.target.value })} /></label>
        <label>제목 글자 크기<input aria-label="제목 글자 크기" type="range" min="28" max="96" value={layout.titleStyle.fontSize} onChange={(event) => changeCard({ titleStyle: { fontSize: Number(event.target.value) } })} /></label>
        <label>본문 글자 크기<input aria-label="본문 글자 크기" type="range" min="18" max="54" value={layout.bodyStyle.fontSize} onChange={(event) => changeCard({ bodyStyle: { fontSize: Number(event.target.value) } })} /></label>
        <label>제목 색상<input aria-label="제목 색상" type="color" value={layout.titleStyle.color} onChange={(event) => changeCard({ titleStyle: { color: event.target.value } })} /></label>
        <label>제목 가로 위치<input aria-label="제목 가로 위치" type="range" min="40" max="300" value={layout.titleFrame.x} onChange={(event) => changeCard({ titleFrame: { x: Number(event.target.value) } })} /></label>
        <label>본문 정렬<select aria-label="본문 정렬" value={layout.bodyStyle.align} onChange={(event) => changeCard({ bodyStyle: { align: event.target.value === "center" ? "center" : event.target.value === "right" ? "right" : "left" } })}><option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option></select></label>
        <div className="asset-status"><strong>이미지 슬롯</strong><span>{layout.image.assetId === undefined ? "승인된 자산 없음 · placeholder" : layout.image.assetId}</span></div>
        <label>Revision 복원<select aria-label="Revision 복원" value="" onChange={(event) => { if (event.target.value !== "") setDesign((previous) => restoreDesignRevision(previous, { revision: Number(event.target.value), now: new Date().toISOString() })) }}><option value="">복원할 revision 선택</option>{design.revisionHistory.slice(0, -1).map((entry) => <option key={entry.revision} value={entry.revision}>Revision {entry.revision}</option>)}</select></label>
      </aside>

      <section className="preview-panel">
        <div className={compare ? "preview-grid compare" : "preview-grid"}>
          {compare && <article><h2>변경 전</h2>{mode === "a4" ? <A4Preview document={baseline} /> : <CardPreview page={baseline.cards[selectedCard] ?? baseline.cards[0]} />}</article>}
          <article><h2>{compare ? "현재" : mode === "a4" ? "A4 미리보기" : `${selectedCard === 0 ? "표지" : `${selectedCard}번 카드`} 미리보기`}</h2>{mode === "a4" ? <A4Preview document={current} /> : <CardPreview page={card} />}</article>
        </div>
        <section className={current.issues.length === 0 ? "validation-panel valid" : "validation-panel invalid"} aria-live="polite">
          <h2>조판 검증</h2>
          {current.issues.length === 0 ? <p>overflow와 누락 텍스트가 없습니다.</p> : <ul>{current.issues.map((issue) => <li key={`${issue.pageId}-${issue.blockId}`}>{issue.pageId} · {issue.message}</li>)}</ul>}
        </section>
      </section>
    </section>
  </main>
}
