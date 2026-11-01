import { z } from "zod"
import type { DesignSnapshotV2 } from "./designSchema"

const assetIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/)
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const safeReferenceSchema = z.string().regex(/^asset:[a-f0-9]{64}$/)
const approvalStatusSchema = z.enum(["pending", "approved", "reference-only", "rejected"])
const usageScopeSchema = z.enum(["layout-comparison-only", "qa-only", "newsletter-output"])
const historyEntrySchema = z.object({
  revision: z.number().int().positive(),
  changedAt: z.iso.datetime(),
  approvalStatus: approvalStatusSchema,
  usageScope: usageScopeSchema,
  exportApproval: z.enum(["pending", "approved"]).optional(),
}).readonly()
const assetRecordSchema = z.object({
  assetId: assetIdSchema,
  sha256: sha256Schema,
  origin: z.string().trim().min(1),
  classification: z.enum(["USER_CREATED", "AI_GENERATED", "OFFICIAL_REFERENCE", "LICENSED_EXTERNAL"]),
  purpose: z.enum(["mascot", "illustration", "decoration", "reference"]),
  approvalStatus: approvalStatusSchema,
  usageScope: usageScopeSchema,
  exportApproval: z.enum(["pending", "approved"]).optional(),
  originalReference: safeReferenceSchema,
  mediaType: z.enum(["image/png", "image/jpeg", "image/webp"]),
  originalName: z.string().trim().min(1),
  history: z.array(historyEntrySchema).min(1).readonly(),
}).readonly().superRefine((asset, context) => {
  if (asset.history.some((entry, index) => entry.revision !== index + 1)) context.addIssue({ code: "custom", message: "asset history revisions must be contiguous" })
  const latest = asset.history[asset.history.length - 1]
  if (latest?.approvalStatus !== asset.approvalStatus || latest.usageScope !== asset.usageScope || latest.exportApproval !== asset.exportApproval) context.addIssue({ code: "custom", message: "asset history must end at the current approval state" })
  if (asset.classification === "OFFICIAL_REFERENCE" && asset.approvalStatus === "approved") context.addIssue({ code: "custom", message: "official references cannot become output assets" })
  if (asset.originalReference !== `asset:${asset.sha256}`) context.addIssue({ code: "custom", message: "asset reference must match its sha256" })
})
const registrySchema = z.object({ registryVersion: z.literal(1), assets: z.array(assetRecordSchema).readonly() }).readonly().superRefine((registry, context) => {
  const ids = registry.assets.map((asset) => asset.assetId)
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "asset ids must be unique" })
  const hashes = registry.assets.map((asset) => asset.sha256)
  if (new Set(hashes).size !== hashes.length) context.addIssue({ code: "custom", message: "asset hashes must be unique" })
})

export type NewsletterAssetRegistry = z.infer<typeof registrySchema>
export type NewsletterAssetRecord = z.infer<typeof assetRecordSchema>
export type RegisterNewsletterAssetInput = Omit<NewsletterAssetRecord, "history"> & { readonly now: string }

export class NewsletterAssetNotFoundError extends Error {
  readonly name = "NewsletterAssetNotFoundError"
  constructor(readonly assetId: string) { super(`newsletter asset not found: ${assetId}`) }
}

export function createAssetRegistry(): NewsletterAssetRegistry { return registrySchema.parse({ registryVersion: 1, assets: [] }) }
export function parseAssetRegistry(input: unknown): NewsletterAssetRegistry { return registrySchema.parse(input) }

export function registerNewsletterAsset(registry: NewsletterAssetRegistry, input: RegisterNewsletterAssetInput): NewsletterAssetRegistry {
  return registrySchema.parse({
    ...registry,
    assets: [...registry.assets, { assetId: input.assetId, sha256: input.sha256, origin: input.origin, classification: input.classification, purpose: input.purpose, approvalStatus: input.approvalStatus, usageScope: input.usageScope, ...(input.exportApproval === undefined ? {} : { exportApproval: input.exportApproval }), originalReference: input.originalReference, mediaType: input.mediaType, originalName: input.originalName, history: [{ revision: 1, changedAt: input.now, approvalStatus: input.approvalStatus, usageScope: input.usageScope, ...(input.exportApproval === undefined ? {} : { exportApproval: input.exportApproval }) }] }],
  })
}

export function reviseNewsletterAsset(registry: NewsletterAssetRegistry, input: { readonly assetId: string; readonly approvalStatus: NewsletterAssetRecord["approvalStatus"]; readonly usageScope: NewsletterAssetRecord["usageScope"]; readonly exportApproval?: "pending" | "approved"; readonly now: string }): NewsletterAssetRegistry {
  const target = registry.assets.find((asset) => asset.assetId === input.assetId)
  if (target === undefined) throw new NewsletterAssetNotFoundError(input.assetId)
  return registrySchema.parse({
    ...registry,
    assets: registry.assets.map((asset) => asset.assetId === input.assetId ? {
      ...asset,
      approvalStatus: input.approvalStatus,
      usageScope: input.usageScope,
      ...(input.exportApproval === undefined ? {} : { exportApproval: input.exportApproval }),
      history: [...asset.history, { revision: asset.history.length + 1, changedAt: input.now, approvalStatus: input.approvalStatus, usageScope: input.usageScope, ...((input.exportApproval ?? asset.exportApproval) === undefined ? {} : { exportApproval: input.exportApproval ?? asset.exportApproval }) }],
    } : asset),
  })
}

export function toDesignAssetManifest(registry: NewsletterAssetRegistry): DesignSnapshotV2["assetManifest"] {
  return registry.assets.flatMap((asset) => asset.approvalStatus === "approved" && asset.usageScope === "newsletter-output" && asset.classification !== "OFFICIAL_REFERENCE" && asset.purpose !== "reference" ? [{
    id: asset.assetId,
    ...(asset.exportApproval === undefined ? {} : { exportApproval: asset.exportApproval }),
    sha256: asset.sha256,
    mediaType: asset.mediaType,
    approvalStatus: "approved" as const,
    originalName: asset.originalName,
    localReference: asset.originalReference,
    registry: { classification: asset.classification, purpose: asset.purpose, usageScope: asset.usageScope },
  }] : [])
}
