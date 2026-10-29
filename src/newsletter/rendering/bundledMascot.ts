import otterSource from "./assets/otter-primary-v1.png?inline"
import { parseAssetRegistry, toDesignAssetManifest } from "./assetRegistry"
import { parseNewsletterDesignStateV2 } from "./designSchema"
import type { DesignSnapshotV2, NewsletterDesignStateV2 } from "./designSchema"

export const OTTER_ASSET_ID = "otter-primary-v1"
export const OTTER_SHA256 = "fd90b63e8d78ee53eb796c130315ac71d4c5a2a8b4af92e8e03cefdccc3ce302"
export const OTTER_PIXEL_SIZE = { width: 1254, height: 1254 } as const
export const bundledMascotRegistry = parseAssetRegistry({
  registryVersion: 1,
  assets: [{
    assetId: OTTER_ASSET_ID, sha256: OTTER_SHA256,
    origin: "User-created September mascot; approved alpha-clean v1 derivative",
    classification: "USER_CREATED", purpose: "mascot", approvalStatus: "approved",
    exportApproval: "pending", usageScope: "newsletter-output",
    originalReference: `asset:${OTTER_SHA256}`, mediaType: "image/png",
    originalName: "otter-primary-alpha-clean-v1.png",
    history: [{ exportApproval: "pending", revision: 1, changedAt: "2026-10-29T00:00:00.000Z", approvalStatus: "approved", usageScope: "newsletter-output" }],
  }],
})

export class BundledMascotConflictError extends Error {
  readonly name = "BundledMascotConflictError"
  constructor(readonly assetId: string, readonly reason: "duplicate-sha" | "id-collision" | "approval-conflict") {
    super(`Bundled mascot conflict: ${reason} (${assetId})`)
  }
}
export class BundledMascotBrandMissingError extends Error {
  readonly name = "BundledMascotBrandMissingError"
  constructor(readonly pageId: string) { super(`Prepare a brand frame before attaching mascot: ${pageId}`) }
}
export function bundledMascotSource(assetId: string): string | undefined {
  return assetId === OTTER_ASSET_ID ? otterSource : undefined
}

export function attachApprovedMascot(design: NewsletterDesignStateV2, now: string): NewsletterDesignStateV2 {
  for (const asset of design.assetManifest) {
    if (asset.sha256 === OTTER_SHA256 && asset.id !== OTTER_ASSET_ID) throw new BundledMascotConflictError(asset.id, "duplicate-sha")
    if (asset.id === OTTER_ASSET_ID && asset.sha256 !== OTTER_SHA256) throw new BundledMascotConflictError(asset.id, "id-collision")
  }
  const existing = design.assetManifest.find((asset) => asset.id === OTTER_ASSET_ID)
  if (existing !== undefined && (existing.approvalStatus !== "approved" || existing.exportApproval !== bundledMascotRegistry.assets[0]?.exportApproval || existing.registry?.classification !== "USER_CREATED" || existing.registry.purpose !== "mascot" || existing.registry.usageScope !== "newsletter-output")) {
    throw new BundledMascotConflictError(existing.id, "approval-conflict")
  }
  const a4Brand = design.a4Layout.brand
  if (a4Brand === undefined) throw new BundledMascotBrandMissingError("a4-page")
  const cardLayouts = design.cardLayouts.map((card) => {
    if (card.brand === undefined) throw new BundledMascotBrandMissingError(card.pageId)
    return { ...card, brand: { ...card.brand, mascot: { ...card.brand.mascot, assetId: OTTER_ASSET_ID, fit: "contain" as const } } }
  })
  const alreadyBound = a4Brand.mascot.assetId === OTTER_ASSET_ID && a4Brand.mascot.fit === "contain"
    && design.cardLayouts.every((card) => card.brand?.mascot.assetId === OTTER_ASSET_ID && card.brand.mascot.fit === "contain")
  if (existing !== undefined && alreadyBound) return design
  const assetManifest = existing === undefined ? [...design.assetManifest, ...toDesignAssetManifest(bundledMascotRegistry)] : design.assetManifest
  const snapshot: DesignSnapshotV2 = {
    designSchemaVersion: 2,
    canonicalProjectRevision: design.canonicalProjectRevision,
    templateId: design.templateId, templateVersion: design.templateVersion,
    publicationMeta: design.publicationMeta,
    a4Layout: { ...design.a4Layout, brand: { ...a4Brand, mascot: { ...a4Brand.mascot, assetId: OTTER_ASSET_ID, fit: "contain" } } },
    cardLayouts, assetManifest,
  }
  const revision = design.designRevision + 1
  return parseNewsletterDesignStateV2({
    ...snapshot, projectId: design.projectId, designRevision: revision,
    revisionHistory: [...design.revisionHistory, { revision, createdAt: now, changedPageIds: ["a4-page", ...cardLayouts.map((card) => card.pageId)], snapshotVersion: 2, snapshot }],
  })
}
