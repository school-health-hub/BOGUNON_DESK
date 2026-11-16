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
  badge: { x: 440, y: 70, width: 320, height: 72 },
  title: { x: 170, y: 150, width: 860, height: 138 },
  lead: { x: 220, y: 302, width: 760, height: 82 },
  leadRuleLeft: { x: 105, y: 339, width: 90, height: 2 },
  leadRuleRight: { x: 1005, y: 339, width: 90, height: 2 },
  image: { x: 55, y: 400, width: 455, height: 585 },
  actions: Array.from({ length: 4 }, (_, index): Frame => ({ x: 535, y: 400 + index * 145, width: 600, height: 145 })),
  actionText: Array.from({ length: 4 }, (_, index): Frame => ({ x: 690, y: 414 + index * 145, width: index === 3 ? 340 : 400, height: 122 })),
  miniArt: Array.from({ length: 4 }, (_, index): Frame => ({ x: 545, y: 411 + index * 145, width: 112, height: 112 })),
  closing: { x: 215, y: 1042, width: 730, height: 88 },
  mascot: { x: 1038, y: 830, width: 132, height: 224 },
} as const

export const SEPTEMBER_INNER_TOKENS = {
  color: { paper: "#FFFDF7", ink: "#081F49", body: "#1E2938", green: "#176B45", greenStrong: "#0E5938", mint: "#F1F8F2", mintLine: "#A9CEB4", divider: "#D8E4D9", autumn: "#D7882A" },
  type: {
    badge: { fontSize: 32, fontWeight: 760, lineHeight: 1.1 },
    title: { fontSize: 76, fontWeight: 800, lineHeight: 1.08 },
    lead: { fontSize: 29, fontWeight: 650, lineHeight: 1.3 },
    action: { fontSize: 28, fontWeight: 680, lineHeight: 1.32 },
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
  if (action.length > 58) return { fontSize: 23, fontWeight: 680, lineHeight: 1.3 }
  if (action.length > 30) return { fontSize: 25, fontWeight: 680, lineHeight: 1.3 }
  return SEPTEMBER_INNER_TOKENS.type.action
}
