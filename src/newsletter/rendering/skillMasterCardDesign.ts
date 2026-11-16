import type { Frame } from "./renderDocument"

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
  title: { x: 185, y: 146, width: 830, height: 142 },
  lead: { x: 225, y: 306, width: 750, height: 72 },
  leadRuleLeft: { x: 105, y: 339, width: 90, height: 2 },
  leadRuleRight: { x: 1005, y: 339, width: 90, height: 2 },
  image: { x: 54, y: 397, width: 458, height: 590 },
  actions: Array.from({ length: 4 }, (_, index): Frame => ({ x: 530, y: 397 + index * 145, width: 610, height: 145 })),
  actionText: Array.from({ length: 4 }, (_, index): Frame => ({ x: 684, y: 414 + index * 145, width: index === 3 ? 300 : 430, height: 122 })),
  miniArt: Array.from({ length: 4 }, (_, index): Frame => ({ x: 540, y: 407 + index * 145, width: 116, height: 116 })),
  closing: { x: 240, y: 1054, width: 705, height: 78 },
  mascot: { x: 900, y: 742, width: 286, height: 392 },
} as const

export const SEPTEMBER_INNER_TOKENS = {
  color: { paper: "#FFFEFB", ink: "#061E4A", body: "#171A1F", green: "#18733F", greenStrong: "#0A713A", mint: "#F4F9F1", mintLine: "#83B68F", divider: "#CFE3D2", autumn: "#D96B1A", titleOutline: "#F7FAF5", titleShadow: "#B9C8D1" },
  type: {
    badge: { fontSize: 32, fontWeight: 760, lineHeight: 1.1 },
    title: { fontSize: 84, fontWeight: 850, lineHeight: 1.04 },
    lead: { fontSize: 29, fontWeight: 650, lineHeight: 1.3 },
    action: { fontSize: 27, fontWeight: 680, lineHeight: 1.28 },
    closing: { fontSize: 21, fontWeight: 620, lineHeight: 1.35 },
    missingArt: { fontSize: 16, fontWeight: 650, lineHeight: 1.25 },
  },
  radius: { outer: 34, pill: 34, image: 22, miniArt: 56, closing: 44 },
} as const

export function septemberInnerTitleStyle(title: string): Readonly<{ fontSize: number; fontWeight: number; lineHeight: number }> {
  if (title.length > 16) return { fontSize: 56, fontWeight: 800, lineHeight: 1.12 }
  if (title.length > 11) return { fontSize: 64, fontWeight: 800, lineHeight: 1.1 }
  return SEPTEMBER_INNER_TOKENS.type.title
}

export function septemberInnerActionStyle(action: string): Readonly<{ fontSize: number; fontWeight: number; lineHeight: number }> {
  if (action.length > 58) return { fontSize: 21, fontWeight: 680, lineHeight: 1.27 }
  if (action.length > 30) return { fontSize: 23, fontWeight: 680, lineHeight: 1.28 }
  return SEPTEMBER_INNER_TOKENS.type.action
}

export function septemberActionHighlights(action: string): readonly string[] {
  if (action.includes("비누") && action.includes("손 씻기")) return ["비누", "손 씻기"]
  if (action.includes("옷소매") && action.includes("가리기")) return ["옷소매", "가리기"]
  if (action.includes("휴지통") && action.includes("손 씻기")) return ["휴지", "손 씻기"]
  if (action.includes("알리기") || action.includes("알리")) return ["발열·기침", "알리기"]
  return []
}
