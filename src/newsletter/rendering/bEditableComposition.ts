import type { NewsletterDesignStateV2, TextStyle } from "./designSchema"
import type { Frame } from "./renderDocument"
import type { OfficialElement, OfficialImageBinding, OfficialTemplate, OfficialTextBinding } from "./officialTemplateSchema"
import { reviseOfficialComposition } from "./officialTemplate"
import { DesignCardNotFoundError } from "./designState"

export type BCompositionAssets = {
  readonly background: string
  readonly students: string
  readonly props: readonly [string, string, string, string]
  readonly season: string
  readonly actions: readonly [string, string, string, string]
}
const ink = "#10264A"
const mint = "#28775F"
function text(id: string, label: string, binding: OfficialTextBinding, frame: Frame, fontSize: number, color = ink, align: TextStyle["align"] = "left"): OfficialElement {
  return { kind: "text", id, label, binding, frame, style: { fontFamily: "Pretendard", fontSize, color, align, fontWeight: 800, lineHeight: 1.15 }, zOrder: 40 }
}
function image(id: string, label: string, binding: OfficialImageBinding, assetId: string | undefined, frame: Frame, zOrder: number, visible = true): Extract<OfficialElement, { readonly kind: "image" }> {
  return { kind: "image", id, label, binding, ...(assetId === undefined ? {} : { assetId }), frame, zOrder, fit: "contain", edgePolicy: "none", visible }
}
export function bEditableCoverRecipe(assets: BCompositionAssets): OfficialTemplate {
  const elements: OfficialElement[] = [
    { ...image("background", "가을 학교 배경", "main", assets.background, { x: 0, y: 0, width: 1200, height: 1200 }, 1), fit: "cover" as const },
    { ...image("students", "학생 3명 대표 장면", "main", assets.students, { x: 0, y: 435, width: 1200, height: 595 }, 10), fit: "cover" as const },
    text("month", "월 제목", "month", { x: 140, y: 60, width: 315, height: 200 }, 166, "#E95164"),
    text("headline", "보건소식지 제목", "title-rest", { x: 460, y: 85, width: 705, height: 155 }, 118),
    { kind: "ornament", id: "theme-brush", label: "테마 민트 강조", graphic: "brush", frame: { x: 230, y: 250, width: 745, height: 75 }, color: "#D8EAD9", fill: "#D8EAD9", zOrder: 20 },
    text("theme", "월별 테마", "lead", { x: 250, y: 263, width: 710, height: 60 }, 36, mint, "center"),
    image("season", "선택 계절 장식", "decoration", assets.season, { x: 15, y: 1025, width: 250, height: 160 }, 15, false),
    image("mascot", "선택 수달쌤", "mascot", undefined, { x: 1010, y: 1055, width: 130, height: 130 }, 32, false),
    text("closing", "하단 건강 메시지", "closing", { x: 210, y: 1060, width: 800, height: 125 }, 35, mint, "center"),
  ]
  for (const index of [0, 1, 2, 3] as const) {
    const binding: OfficialTextBinding = `preview-${index}`
    elements.push(text(`preview-${index}`, `건강 주제 ${index + 1}`, binding, { x: 135 + index * 275, y: 335, width: 230, height: 92 }, 29))
    elements.push(image(`preview-prop-${index}`, `건강 소품 ${index + 1}`, "main", assets.props[index], { x: 60 + index * 285, y: 380, width: 85, height: 85 }, 25))
  }
  return { version: 1, kind: "cover", previewTopicIndices: [0, 1, 2, 5], elements }
}
export function bEditableEducationRecipe(assets: BCompositionAssets): OfficialTemplate {
  const elements: OfficialElement[] = [
    text("headline", "겨울 장염 예방 제목", "title", { x: 120, y: 25, width: 1030, height: 160 }, 108),
    { kind: "ornament", id: "lead-brush", label: "부제 민트 강조", graphic: "brush", frame: { x: 245, y: 170, width: 700, height: 67 }, color: "#E0F0E4", fill: "#E0F0E4", zOrder: 3 },
    text("subtitle", "한 줄 부제", "lead", { x: 245, y: 185, width: 700, height: 55 }, 32, ink, "center"),
    image("mascot", "선택 수달쌤", "mascot", undefined, { x: 1035, y: 1060, width: 125, height: 125 }, 32, false),
    { kind: "ornament", id: "closing-brush", label: "하단 메시지 강조", graphic: "brush", frame: { x: 100, y: 1060, width: 900, height: 120 }, color: "#E0F0E4", fill: "#E0F0E4", zOrder: 3 },
    text("closing", "하단 건강 메시지", "closing", { x: 145, y: 1070, width: 830, height: 110 }, 32, mint, "center"),
  ]
  const frames = [
    { number: { x: 40, y: 270, width: 80, height: 90 }, action: { x: 135, y: 280, width: 430, height: 115 }, scene: { x: 110, y: 380, width: 485, height: 310 } },
    { number: { x: 600, y: 270, width: 80, height: 90 }, action: { x: 700, y: 280, width: 450, height: 115 }, scene: { x: 730, y: 355, width: 465, height: 335 } },
    { number: { x: 40, y: 680, width: 80, height: 90 }, action: { x: 135, y: 690, width: 430, height: 100 }, scene: { x: 80, y: 790, width: 495, height: 270 } },
    { number: { x: 600, y: 680, width: 80, height: 90 }, action: { x: 700, y: 690, width: 450, height: 120 }, scene: { x: 650, y: 825, width: 540, height: 235 } },
  ] as const
  for (const index of [0, 1, 2, 3] as const) {
    const frame = frames[index]
    elements.push(text(`number-${index}`, `행동 ${index + 1} 번호`, `number-${index}`, frame.number, 56, mint))
    elements.push(text(`action-${index}`, `행동 ${index + 1} 수칙`, `action-${index}`, frame.action, index === 3 ? 28 : 31))
    elements.push(image(`action-scene-${index}`, `행동 ${index + 1} 삽화`, `module-${index}`, assets.actions[index], frame.scene, 15))
  }
  return { version: 1, kind: "education", elements }
}
export function applyBEditableComposition(design: NewsletterDesignStateV2, input: { readonly cardIndices: readonly number[]; readonly assets: BCompositionAssets; readonly now: string; readonly closingText?: string }): NewsletterDesignStateV2 {
  const indices = new Set(input.cardIndices)
  for (const index of indices) if (!Number.isInteger(index) || design.cardLayouts[index] === undefined) throw new DesignCardNotFoundError(index)
  const cards = design.cardLayouts.map((card, index) => indices.has(index) ? { ...card, background: "#FFFCF5", officialTemplate: { ...(index === 0 ? bEditableCoverRecipe(input.assets) : bEditableEducationRecipe(input.assets)), ...(input.closingText === undefined ? {} : { closingText: input.closingText }) } } : card)
  return reviseOfficialComposition(design, cards, cards.filter((_, index) => indices.has(index)).map(card => card.pageId), input.now)
}
