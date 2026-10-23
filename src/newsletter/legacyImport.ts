import { z } from "zod"
import { semanticHash } from "./hash"
import { createNewsletterProject } from "./project"
import type { NewsletterProject } from "./schema"

export const OTTER_NEST_SOURCE_SHA = "8d4a50c94b38747fa433a169407af6afb23976df" as const

const contentCardFields = {
  title: z.string(),
  body: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  iconKey: z.string().optional(),
  visualKey: z.string().optional(),
  otterScene: z.string().optional(),
  designMemo: z.string().optional(),
} as const
const contentCardSchema = z.object(contentCardFields).passthrough().readonly()
const commonFields = {
  title: z.string().min(1), subtitle: z.string().optional(), target: z.string().optional(), schoolLevel: z.string().optional(), month: z.string().optional(),
  topics: z.array(z.string()).optional(), footerBrand: z.enum(["health-room", "hidden"]).optional(), footerLabel: z.string().optional(),
  imagePrompt: z.string().optional(), reviewChecklist: z.array(z.string()).optional(),
} as const
const a4Schema = z.object({
  type: z.literal("a4"), ...commonFields, keywordBar: z.enum(["show", "hidden"]).optional(), intro: z.string().optional(),
  mainCard: contentCardSchema, sectionCards: z.array(contentCardSchema).optional(), miniCards: z.array(contentCardSchema).optional(),
  healthRoom: contentCardSchema.optional(), footer: z.string().optional(),
}).passthrough().readonly()
const cardItemSchema = z.object({ ...contentCardFields, cardNo: z.number().int().positive(), role: z.string().optional() }).passthrough().readonly()
const cardNewsSchema = z.object({ type: z.literal("cardnews"), ...commonFields, cards: z.array(cardItemSchema) }).passthrough().readonly()
const legacySchema = z.discriminatedUnion("type", [a4Schema, cardNewsSchema])
type ContentCard = z.infer<typeof contentCardSchema>

type ImportReport = {
  readonly status: "imported" | "partial"
  readonly sourceSha: typeof OTTER_NEST_SOURCE_SHA
  readonly inputProvenance: "unknown" | "synthetic-fixture"
  readonly sourceShapeHash: string
  readonly confirmationRequired: boolean
  readonly unmappedEndingCard?: z.infer<typeof cardItemSchema>
  readonly unmappedSourceFields: Readonly<Record<string, unknown>>
  readonly unmappedUnknownFields: readonly { readonly path: string; readonly value: unknown }[]
}

export type LegacyImportResult = { readonly project: NewsletterProject; readonly report: ImportReport }

export class LegacyImportShapeError extends Error {
  readonly name = "LegacyImportShapeError"
  constructor(readonly mappedCardCount: number) {
    super(`legacy import requires six topic cards; found ${mappedCardCount}`)
  }
}

function cardText(card: ContentCard): string {
  return [card.body, ...(card.bullets ?? [])].filter((part) => part !== undefined).join("\n")
}

const COMMON_KEYS = ["type", "title", "subtitle", "target", "schoolLevel", "month", "topics", "footerBrand", "footerLabel", "imagePrompt", "reviewChecklist"] as const
const CARD_KEYS = ["title", "body", "bullets", "iconKey", "visualKey", "otterScene", "designMemo"] as const

function unknownEntries(value: Readonly<Record<string, unknown>>, knownKeys: readonly string[], prefix: string): readonly { readonly path: string; readonly value: unknown }[] {
  const known = new Set(knownKeys)
  return Object.entries(value).filter(([key]) => !known.has(key)).map(([key, item]) => ({ path: `${prefix}.${key}`, value: item }))
}

export async function importOtterNest(input: unknown, options: { readonly projectId: string; readonly now: string; readonly inputProvenance?: "unknown" | "synthetic-fixture" }): Promise<LegacyImportResult> {
  const untouchedInput = structuredClone(input)
  const sourceShapeHash = await semanticHash(untouchedInput)
  const legacy = legacySchema.parse(untouchedInput)
  const cards = legacy.type === "cardnews"
    ? [...legacy.cards.filter((card) => card.cardNo >= 2 && card.cardNo <= 7)].sort((left, right) => left.cardNo - right.cardNo)
    : [legacy.mainCard, ...(legacy.sectionCards ?? []), ...(legacy.miniCards ?? []), ...(legacy.healthRoom === undefined ? [] : [legacy.healthRoom])].slice(0, 6)
  if (cards.length !== 6) throw new LegacyImportShapeError(cards.length)
  const topics = cards.map((card, index) => ({ id: `legacy-topic-${index + 1}`, title: card.title, text: cardText(card) }))
  const project = await createNewsletterProject({ projectId: options.projectId, title: legacy.title, now: options.now, topics })
  const endingCard = legacy.type === "cardnews" ? legacy.cards.find((card) => card.cardNo === 8) : undefined
  const topLevelKeys = legacy.type === "cardnews"
    ? [...COMMON_KEYS, "cards"]
    : [...COMMON_KEYS, "keywordBar", "intro", "mainCard", "sectionCards", "miniCards", "healthRoom", "footer"]
  const nestedUnknownFields = legacy.type === "cardnews"
    ? legacy.cards.flatMap((card, index) => unknownEntries(card, [...CARD_KEYS, "cardNo", "role"], `cards[${index}]`))
    : [legacy.mainCard, ...(legacy.sectionCards ?? []), ...(legacy.miniCards ?? []), ...(legacy.healthRoom === undefined ? [] : [legacy.healthRoom])]
      .flatMap((card, index) => unknownEntries(card, CARD_KEYS, `contentCards[${index}]`))
  const unmappedUnknownFields = [...unknownEntries(legacy, topLevelKeys, "$"), ...nestedUnknownFields]
  const confirmationRequired = endingCard !== undefined || unmappedUnknownFields.length > 0
  const { title: _title, type: _type, ...unmappedSourceFields } = legacy
  return {
    project,
    report: {
      status: confirmationRequired ? "partial" : "imported",
      sourceSha: OTTER_NEST_SOURCE_SHA,
      inputProvenance: options.inputProvenance ?? "unknown",
      sourceShapeHash,
      confirmationRequired,
      ...(endingCard === undefined ? {} : { unmappedEndingCard: endingCard }),
      unmappedSourceFields,
      unmappedUnknownFields,
    },
  }
}

export const SYNTHETIC_OTTER_NEST_FIXTURE = {
  type: "cardnews",
  title: "Synthetic legacy newsletter",
  subtitle: "Not captured persisted JSON",
  cards: [
    { cardNo: 1, title: "Cover", role: "cover" },
    ...Array.from({ length: 6 }, (_, index) => ({ cardNo: index + 2, title: `Topic ${index + 1}`, body: `Synthetic body ${index + 1}`, bullets: [`Synthetic bullet ${index + 1}`] })),
    { cardNo: 8, title: "Closing", body: "Synthetic ending", role: "ending", designMemo: "Preserve for confirmation" },
  ],
  reviewChecklist: ["Synthetic only"],
} as const
