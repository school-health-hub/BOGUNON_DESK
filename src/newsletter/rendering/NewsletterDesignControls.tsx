import {
  applyA4ImageTextRatio,
  applyA4LayoutVariant,
  applyCardImageTextRatio,
  applyCardLayoutVariant,
  applyCoverLayout,
  updateA4ModuleLayout,
  updateCardLayout,
} from "./designState"
import type { NewsletterDesignStateV2 } from "./designSchema"
import { variantFromRatio, type NewsletterLayoutVariant } from "./layoutVariants"
import type { Frame } from "./renderDocument"

type Mode = "a4" | "cards"
type FrameKind = "title" | "body" | "image" | "closing"
type Props = {
  readonly design: NewsletterDesignStateV2
  readonly mode: Mode
  readonly selectedIndex: number
  readonly onChange: (design: NewsletterDesignStateV2) => void
}

const now = (): string => new Date().toISOString()

function FrameEditor({ frame, onChange }: { readonly frame: Frame; readonly onChange: (patch: Partial<Frame>) => void }) {
  const fields = [["x", "가로"], ["y", "세로"], ["width", "너비"], ["height", "높이"]] as const
  return <div className="frame-grid">
    {fields.map(([key, label]) => <label key={key}>{label}<input type="number" min="0" aria-label={`프레임 ${label}`} value={Math.round(frame[key])} onChange={(event) => onChange({ [key]: Number(event.target.value) })} /></label>)}
  </div>
}

function LayoutFields({ ratio, accent, marker, onAccent, onMarker, onVariant, onRatio }: {
  readonly ratio: number
  readonly accent: string
  readonly marker: "source" | "number" | "dot" | "check"
  readonly onAccent: (value: string) => void
  readonly onMarker: (value: "source" | "number" | "dot" | "check") => void
  readonly onVariant: (value: NewsletterLayoutVariant) => void
  readonly onRatio: (value: number) => void
}) {
  return <>
    <label>레이아웃 variant<select aria-label="레이아웃 variant" value={variantFromRatio(ratio)} onChange={(event) => onVariant(event.target.value as NewsletterLayoutVariant)}><option value="balanced">균형형</option><option value="image-focus">이미지 강조</option><option value="text-focus">텍스트 강조</option></select></label>
    <label>이미지 비율 <output>{Math.round(ratio * 100)}%</output><input aria-label="이미지 텍스트 비율" type="range" min="25" max="50" value={Math.round(ratio * 100)} onChange={(event) => onRatio(Number(event.target.value) / 100)} /></label>
    <label>강조색<input aria-label="주제 강조색" type="color" value={accent} onChange={(event) => onAccent(event.target.value)} /></label>
    <label>목록 marker<select aria-label="목록 marker" value={marker} onChange={(event) => onMarker(event.target.value as typeof marker)}><option value="source">원문 유지</option><option value="dot">점</option><option value="number">번호</option><option value="check">체크</option></select></label>
  </>
}

export function NewsletterDesignControls({ design, mode, selectedIndex, onChange }: Props) {
  const [frameKind, setFrameKind] = useFrameKind()
  if (mode === "a4") {
    const module = design.a4Layout.modules[selectedIndex]
    if (module === undefined) return null
    const frame = frameKind === "title" ? module.titleFrame : frameKind === "body" ? module.actionListFrame : frameKind === "image" ? module.image.frame : module.closingFrame
    const updateFrame = (patch: Partial<Frame>): void => {
      const key = frameKind === "title" ? "titleFrame" : frameKind === "body" ? "actionListFrame" : frameKind === "closing" ? "closingFrame" : undefined
      onChange(updateA4ModuleLayout(design, { moduleIndex: selectedIndex, now: now(), patch: key === undefined ? { image: { frame: patch } } : { [key]: patch } }))
    }
    return <div className="control-stack">
      <LayoutFields ratio={module.imageTextColumnRatio} accent={module.accent} marker={module.listMarkerStyle} onAccent={(accent) => onChange(updateA4ModuleLayout(design, { moduleIndex: selectedIndex, now: now(), patch: { accent } }))} onMarker={(listMarkerStyle) => onChange(updateA4ModuleLayout(design, { moduleIndex: selectedIndex, now: now(), patch: { listMarkerStyle } }))} onVariant={(variant) => onChange(applyA4LayoutVariant(design, { moduleIndex: selectedIndex, variant, now: now() }))} onRatio={(ratio) => onChange(applyA4ImageTextRatio(design, { moduleIndex: selectedIndex, ratio, now: now() }))} />
      <FrameFields frameKind={frameKind} frame={frame} onKind={setFrameKind} onChange={updateFrame} />
    </div>
  }

  const card = design.cardLayouts[selectedIndex]
  if (card === undefined) return null
  const frame = frameKind === "title" ? card.titleFrame : frameKind === "body" ? card.actionListFrame : frameKind === "image" ? card.image.frame : card.closingFrame
  const updateFrame = (patch: Partial<Frame>): void => {
    const key = frameKind === "title" ? "titleFrame" : frameKind === "body" ? "actionListFrame" : frameKind === "closing" ? "closingFrame" : undefined
    onChange(updateCardLayout(design, { cardIndex: selectedIndex, now: now(), patch: key === undefined ? { image: { frame: patch } } : { [key]: patch } }) as NewsletterDesignStateV2)
  }
  return <div className="control-stack">
    {selectedIndex === 0 && <label>표지 구조<select aria-label="표지 구조" value={card.coverLayout} onChange={(event) => onChange(applyCoverLayout(design, { layout: event.target.value as typeof card.coverLayout, now: now() }))}><option value="topics-grid">주제 2×3</option><option value="feature-right">오른쪽 이미지</option><option value="feature-center">중앙 이미지</option></select></label>}
    <LayoutFields ratio={card.imageTextColumnRatio} accent={card.accent} marker={card.listMarkerStyle} onAccent={(accent) => onChange(updateCardLayout(design, { cardIndex: selectedIndex, now: now(), patch: { accent } }) as NewsletterDesignStateV2)} onMarker={(listMarkerStyle) => onChange(updateCardLayout(design, { cardIndex: selectedIndex, now: now(), patch: { listMarkerStyle } }) as NewsletterDesignStateV2)} onVariant={(variant) => onChange(applyCardLayoutVariant(design, { cardIndex: selectedIndex, variant, now: now() }))} onRatio={(ratio) => onChange(applyCardImageTextRatio(design, { cardIndex: selectedIndex, ratio, now: now() }))} />
    <FrameFields frameKind={frameKind} frame={frame} onKind={setFrameKind} onChange={updateFrame} />
  </div>
}

function useFrameKind(): [FrameKind, (kind: FrameKind) => void] {
  return useState<FrameKind>("title")
}

function FrameFields({ frameKind, frame, onKind, onChange }: { readonly frameKind: FrameKind; readonly frame: Frame; readonly onKind: (kind: FrameKind) => void; readonly onChange: (patch: Partial<Frame>) => void }) {
  return <fieldset className="frame-editor"><legend>프레임 미세 조정</legend><label>편집 영역<select aria-label="프레임 편집 영역" value={frameKind} onChange={(event) => onKind(event.target.value as FrameKind)}><option value="title">제목</option><option value="body">본문·목록</option><option value="image">삽화</option><option value="closing">마무리</option></select></label><FrameEditor frame={frame} onChange={onChange} /></fieldset>
}
import { useState } from "react"
