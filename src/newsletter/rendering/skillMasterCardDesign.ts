import type { Frame, RenderTextBlock } from "./renderDocument"
import { estimatedTextWidth, layoutText } from "./typography"

export const SEPTEMBER_MASTER_DESIGN_REVISION = "ns16-november-review-1"

type SeptemberInnerTemplate = Readonly<{
  badge: Frame
  title: Frame
  lead: Frame
  leadRuleLeft: Frame
  leadRuleRight: Frame
  image: Frame
  actions: readonly Frame[]
  actionText: readonly Frame[]
  miniArt: readonly Frame[]
  closing: Frame
  mascot: Frame
}>

/** Normalized from the bundled 900×900 September inner-card master. */
export const SEPTEMBER_INNER_TEMPLATE: SeptemberInnerTemplate = {
  badge: { x: 438, y: 66, width: 324, height: 70 },
  title: { x: 140, y: 146, width: 920, height: 142 },
  lead: { x: 225, y: 290, width: 750, height: 72 },
  leadRuleLeft: { x: 105, y: 321, width: 90, height: 2 },
  leadRuleRight: { x: 1005, y: 321, width: 90, height: 2 },
  image: { x: 54, y: 385, width: 478, height: 615 },
  actions: Array.from({ length: 4 }, (_, index): Frame => ({ x: 530, y: 397 + index * 145, width: 610, height: 145 })),
  actionText: Array.from({ length: 4 }, (_, index): Frame => ({ x: 684, y: 414 + index * 145, width: index === 3 ? 260 : 430, height: 122 })),
  miniArt: Array.from({ length: 4 }, (_, index): Frame => ({ x: 540, y: 407 + index * 145, width: 116, height: 116 })),
  closing: { x: 170, y: 1045, width: 720, height: 100 },
  mascot: { x: 850, y: 820, width: 350, height: 365 },
} as const

export const SEPTEMBER_INNER_TOKENS = {
  color: { paper: "#FFFEFB", ink: "#061E4A", body: "#171A1F", green: "#18733F", greenStrong: "#0A713A", mint: "#F4F9F1", mintLine: "#83B68F", divider: "#CFE3D2", autumn: "#D96B1A", titleOutline: "#F7FAF5", titleShadow: "#B9C8D1", imageWarmth: "#FFF0D00A" },
  type: {
    badge: { fontSize: 38, fontWeight: 760, lineHeight: 1.1 },
    title: { fontSize: 96, fontWeight: 900, lineHeight: 1.04 },
    lead: { fontSize: 29, fontWeight: 650, lineHeight: 1.3 },
    action: { fontSize: 31, fontWeight: 720, lineHeight: 1.28 },
    closing: { fontSize: 26, fontWeight: 650, lineHeight: 1.35 },
    missingArt: { fontSize: 16, fontWeight: 650, lineHeight: 1.25 },
  },
  radius: { outer: 34, pill: 34, image: 22, miniArt: 56, closing: 44 },
} as const

export function septemberInnerTitleStyle(title: string): Readonly<{ fontSize: number; fontWeight: number; lineHeight: number }> {
  for (const fontSize of [96, 84, 76, 68, 64, 56]) {
    const style = { ...SEPTEMBER_INNER_TOKENS.type.title, fontSize, fontFamily: "Pretendard" as const, color: SEPTEMBER_INNER_TOKENS.color.ink, align: "center" as const }
    if (!layoutText(title, style, SEPTEMBER_INNER_TEMPLATE.title).overflow) return { fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight }
  }
  return { fontSize: 56, fontWeight: 900, lineHeight: 1.04 }
}

export function septemberInnerActionStyle(action: string, width = 430): Readonly<{ fontSize: number; fontWeight: number; lineHeight: number }> {
  if (action.length > 58) return { fontSize: 21, fontWeight: 680, lineHeight: 1.27 }
  if (action.length > 38 || width < 300) return { fontSize: 23, fontWeight: 700, lineHeight: 1.28 }
  if (action.length > 30) return { fontSize: 28, fontWeight: 720, lineHeight: 1.28 }
  return SEPTEMBER_INNER_TOKENS.type.action
}

export function septemberActionHighlights(action: string): readonly string[] {
  return ["손 씻기", "가리기", "버리고", "알리기", "겹쳐 입기", "착용하기", "움직이기", "확인하기", "정하기", "선택하기", "쉬기", "호흡하기", "나누기", "알아주기", "요청하기", "골고루 먹기", "씹기", "표현하기", "동의 구하기", "공유하지 않기", "준비하기", "이동하기", "두지 않기", "기록하기", "넣기", "줄이기", "상의하기", "시작하기", "들어주기", "평가하지 않기", "놀리지 않기", "존중하기"].filter(phrase => action.includes(phrase))
}

/** Move a protected noun phrase as a unit without changing editable source copy. */
export function keepEditorialPhrases(block: RenderTextBlock): RenderTextBlock {
  const lines = [...block.lines]
  for (let index = 0; index < lines.length - 1; index += 1) {
    const current = lines[index]
    const next = lines[index + 1]
    if (current === undefined || next === undefined) continue
    for (const [left, right] of [["위생", "습관"], ["생활", "리듬"], ["건강한", "식사"], ["도움", "요청"], ["신체", "접촉"], ["동의", "구하기"]] as const) {
      if (!current.endsWith(` ${left}`) || !next.startsWith(right)) continue
      const moved = `${left} ${next}`
      if (estimatedTextWidth(moved, block.style) <= block.frame.width) { lines[index] = current.slice(0, -left.length).trimEnd(); lines[index + 1] = moved }
    }
  }
  return { ...block, lines }
}
