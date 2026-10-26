import { z } from "zod"
import { canonicalJson } from "../hash"

const idSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/)
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const isoDateSchema = z.iso.datetime()
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const frameSchema = z.object({ x: z.number().nonnegative(), y: z.number().nonnegative(), width: z.number().positive(), height: z.number().positive() }).readonly()
const textStyleSchema = z.object({ fontFamily: z.literal("Pretendard"), fontSize: z.number().positive(), fontWeight: z.number().int().min(100).max(900), lineHeight: z.number().min(1).max(2), color: colorSchema, align: z.enum(["left", "center", "right"]) }).readonly()
const imageLayerSchema = z.object({ slotId: idSchema, assetId: idSchema.optional(), frame: frameSchema, fit: z.enum(["contain", "cover"]) }).readonly()

const cardLayoutV1Object = z.object({ pageId: idSchema, background: colorSchema, titleFrame: frameSchema, bodyFrame: frameSchema, titleStyle: textStyleSchema, bodyStyle: textStyleSchema, image: imageLayerSchema })
const cardLayoutV1Schema = cardLayoutV1Object.readonly()
const a4ModuleV1Object = z.object({ moduleId: idSchema, frame: frameSchema, image: imageLayerSchema })
const a4ModuleV1Schema = a4ModuleV1Object.readonly()
const a4LayoutV1Object = z.object({ pageId: z.literal("a4-page"), width: z.literal(1240), height: z.literal(1754), exportWidth: z.literal(2480), exportHeight: z.literal(3508), safeMargin: z.literal(59), background: colorSchema, headerFrame: frameSchema, footerFrame: frameSchema, modules: z.array(a4ModuleV1Schema).length(6).readonly() })
const a4LayoutV1Schema = a4LayoutV1Object.readonly()

const listMarkerStyleSchema = z.enum(["source", "number", "dot", "check"])
const structuredFrames = { leadFrame: frameSchema, actionListFrame: frameSchema, closingFrame: frameSchema } as const
const cardLayoutV2Schema = cardLayoutV1Object.extend({ ...structuredFrames, accent: colorSchema, listMarkerStyle: listMarkerStyleSchema, imageTextColumnRatio: z.number().min(0.25).max(0.75), coverLayout: z.enum(["feature-right", "feature-center", "topics-grid"]) }).readonly()
const a4ModuleV2Schema = a4ModuleV1Object.extend({ titleFrame: frameSchema, ...structuredFrames, accent: colorSchema, listMarkerStyle: listMarkerStyleSchema, imageTextColumnRatio: z.number().min(0.25).max(0.75) }).readonly()
const a4LayoutV2Schema = a4LayoutV1Object.omit({ headerFrame: true, modules: true }).extend({ titleFrame: frameSchema, publicationMetaFrame: frameSchema, modules: z.array(a4ModuleV2Schema).length(6).readonly() }).readonly()

const assetSchema = z.object({ id: idSchema, sha256: sha256Schema, mediaType: z.enum(["image/png", "image/jpeg", "image/webp"]), approvalStatus: z.enum(["approved", "reference-only", "rejected"]), originalName: z.string().trim().min(1), localReference: z.string().regex(/^asset:[a-f0-9]{64}$/).optional() }).readonly()
const publicationMetaSchema = z.object({ schoolName: z.string().trim().min(1), issueLabel: z.string().trim().min(1) }).readonly()
const snapshotBase = { canonicalProjectRevision: z.number().int().positive(), templateId: idSchema, templateVersion: z.number().int().positive(), publicationMeta: publicationMetaSchema, assetManifest: z.array(assetSchema).readonly() } as const
const designSnapshotV1Schema = z.object({ ...snapshotBase, a4Layout: a4LayoutV1Schema, cardLayouts: z.array(cardLayoutV1Schema).length(7).readonly() }).readonly()
const designSnapshotV2Schema = z.object({ designSchemaVersion: z.literal(2), ...snapshotBase, a4Layout: a4LayoutV2Schema, cardLayouts: z.array(cardLayoutV2Schema).length(7).readonly() }).readonly()

const revisionBase = { revision: z.number().int().positive(), createdAt: isoDateSchema, changedPageIds: z.array(idSchema).readonly(), restoredFromRevision: z.number().int().positive().optional() } as const
const designRevisionV1Schema = z.object({ ...revisionBase, snapshot: designSnapshotV1Schema }).readonly()
const designRevisionV2Schema = z.discriminatedUnion("snapshotVersion", [
  z.object({ ...revisionBase, snapshotVersion: z.literal(1), snapshot: designSnapshotV1Schema }).readonly(),
  z.object({ ...revisionBase, snapshotVersion: z.literal(2), snapshot: designSnapshotV2Schema }).readonly(),
])

type CommonDesign = { readonly designRevision: number; readonly cardLayouts: readonly { readonly pageId: string }[]; readonly assetManifest: readonly { readonly id: string }[] }
type CommonRevision = { readonly revision: number; readonly restoredFromRevision?: number }
function validateCommon(design: CommonDesign, revisions: readonly CommonRevision[], issue: (message: string) => void): void {
  const pageIds = design.cardLayouts.map((card) => card.pageId)
  const revisionNumbers = revisions.map((entry) => entry.revision)
  if (pageIds[0] !== "card-cover") issue("first card page must be card-cover")
  if (new Set(pageIds).size !== 7) issue("card page ids must be unique")
  if (new Set(design.assetManifest.map((asset) => asset.id)).size !== design.assetManifest.length) issue("asset ids must be unique")
  if (revisionNumbers.some((revision, index) => revision !== index + 1)) issue("design revisions must be contiguous")
  if (revisionNumbers[revisionNumbers.length - 1] !== design.designRevision) issue("design revision must match history")
  for (const entry of revisions) if (entry.restoredFromRevision !== undefined && (entry.restoredFromRevision >= entry.revision || !revisionNumbers.includes(entry.restoredFromRevision))) issue("restored design revision must reference earlier history")
}

const newsletterDesignStateV1Schema = z.object({ designSchemaVersion: z.literal(1), projectId: idSchema, designRevision: z.number().int().positive(), ...snapshotBase, a4Layout: a4LayoutV1Schema, cardLayouts: z.array(cardLayoutV1Schema).length(7).readonly(), revisionHistory: z.array(designRevisionV1Schema).min(1).readonly() }).readonly().superRefine((design, context) => {
  const issue = (message: string): void => context.addIssue({ code: "custom", message })
  validateCommon(design, design.revisionHistory, issue)
  const current = { canonicalProjectRevision: design.canonicalProjectRevision, templateId: design.templateId, templateVersion: design.templateVersion, publicationMeta: design.publicationMeta, a4Layout: design.a4Layout, cardLayouts: design.cardLayouts, assetManifest: design.assetManifest }
  const finalSnapshot = design.revisionHistory[design.revisionHistory.length - 1]?.snapshot
  if (finalSnapshot !== undefined && canonicalJson(finalSnapshot) !== canonicalJson(current)) issue("final design snapshot must equal current design")
})

const newsletterDesignStateV2Schema = z.object({ designSchemaVersion: z.literal(2), projectId: idSchema, designRevision: z.number().int().positive(), ...snapshotBase, a4Layout: a4LayoutV2Schema, cardLayouts: z.array(cardLayoutV2Schema).length(7).readonly(), revisionHistory: z.array(designRevisionV2Schema).min(2).readonly() }).readonly().superRefine((design, context) => {
  const issue = (message: string): void => context.addIssue({ code: "custom", message })
  validateCommon(design, design.revisionHistory, issue)
  const current = { designSchemaVersion: 2 as const, canonicalProjectRevision: design.canonicalProjectRevision, templateId: design.templateId, templateVersion: design.templateVersion, publicationMeta: design.publicationMeta, a4Layout: design.a4Layout, cardLayouts: design.cardLayouts, assetManifest: design.assetManifest }
  const finalEntry = design.revisionHistory[design.revisionHistory.length - 1]
  if (finalEntry?.snapshotVersion !== 2 || canonicalJson(finalEntry.snapshot) !== canonicalJson(current)) issue("final V2 design snapshot must equal current design")
})

export const newsletterDesignStateSchema = z.discriminatedUnion("designSchemaVersion", [newsletterDesignStateV1Schema, newsletterDesignStateV2Schema])
export type NewsletterDesignStateV1 = z.infer<typeof newsletterDesignStateV1Schema>
export type NewsletterDesignStateV2 = z.infer<typeof newsletterDesignStateV2Schema>
export type NewsletterDesignState = z.infer<typeof newsletterDesignStateSchema>
export type DesignSnapshotV1 = z.infer<typeof designSnapshotV1Schema>
export type DesignSnapshotV2 = z.infer<typeof designSnapshotV2Schema>
export type DesignSnapshot = DesignSnapshotV1 | DesignSnapshotV2
export type CardDesignLayout = NewsletterDesignState["cardLayouts"][number]
export type CardDesignLayoutV1 = NewsletterDesignStateV1["cardLayouts"][number]
export type CardDesignLayoutV2 = NewsletterDesignStateV2["cardLayouts"][number]
export type TextStyle = CardDesignLayout["titleStyle"]

type CreateDesignInput = { readonly projectId: string; readonly canonicalProjectRevision: number; readonly now: string; readonly schoolName?: string; readonly issueLabel?: string }
const titleStyle = { fontFamily: "Pretendard", fontSize: 48, fontWeight: 800, lineHeight: 1.25, color: "#183b4e", align: "left" } as const
const bodyStyle = { fontFamily: "Pretendard", fontSize: 30, fontWeight: 500, lineHeight: 1.5, color: "#29434e", align: "left" } as const
function defaultSnapshot(input: CreateDesignInput): DesignSnapshotV1 {
  const modules = Array.from({ length: 6 }, (_, index) => ({ moduleId: `a4-module-${index + 1}`, frame: { x: 59 + (index % 2) * 566, y: 330 + Math.floor(index / 2) * 405, width: 532, height: 370 }, image: { slotId: `a4-image-${index + 1}`, frame: { x: 415 + (index % 2) * 566, y: 400 + Math.floor(index / 2) * 405, width: 154, height: 120 }, fit: "contain" as const } }))
  const cardLayouts: CardDesignLayoutV1[] = Array.from({ length: 7 }, (_, index) => ({ pageId: index === 0 ? "card-cover" : `card-topic-${index}`, background: index === 0 ? "#f4ead6" : "#fffaf0", titleFrame: { x: 90, y: 90, width: 1020, height: index === 0 ? 300 : 180 }, bodyFrame: { x: 90, y: index === 0 ? 430 : 650, width: 1020, height: index === 0 ? 500 : 420 }, titleStyle: { ...titleStyle, fontSize: index === 0 ? 76 : 56, align: index === 0 ? "center" : "left" }, bodyStyle, image: { slotId: index === 0 ? "cover-image" : `topic-image-${index}`, frame: { x: 310, y: index === 0 ? 720 : 280, width: 580, height: 330 }, fit: "contain" } }))
  return { canonicalProjectRevision: input.canonicalProjectRevision, templateId: "school-health-classic", templateVersion: 1, publicationMeta: { schoolName: input.schoolName ?? "학교명 미설정", issueLabel: input.issueLabel ?? `${input.now.slice(0, 7).replace("-", "년 ")}월` }, a4Layout: { pageId: "a4-page", width: 1240, height: 1754, exportWidth: 2480, exportHeight: 3508, safeMargin: 59, background: "#fffaf0", headerFrame: { x: 59, y: 59, width: 1122, height: 220 }, footerFrame: { x: 59, y: 1580, width: 1122, height: 115 }, modules }, cardLayouts, assetManifest: [] }
}

export function createNewsletterDesignState(input: CreateDesignInput): NewsletterDesignStateV1 {
  const snapshot = defaultSnapshot(input)
  return newsletterDesignStateV1Schema.parse({ designSchemaVersion: 1, projectId: input.projectId, designRevision: 1, ...snapshot, revisionHistory: [{ revision: 1, createdAt: input.now, changedPageIds: ["a4-page", ...snapshot.cardLayouts.map((card) => card.pageId)], snapshot }] })
}
export function parseNewsletterDesignState(input: unknown): NewsletterDesignState { return newsletterDesignStateSchema.parse(input) }
export function parseNewsletterDesignStateV2(input: unknown): NewsletterDesignStateV2 { return newsletterDesignStateV2Schema.parse(input) }
