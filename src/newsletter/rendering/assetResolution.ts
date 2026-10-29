import type { DesignSnapshotV2, NewsletterDesignState } from "./designSchema"
import { bundledMascotRegistry, bundledMascotSource, OTTER_ASSET_ID, OTTER_SHA256 } from "./bundledMascot"

export function assetExportPending(asset: DesignSnapshotV2["assetManifest"][number]): boolean {
  return asset.exportApproval === "pending" || bundledMascotRegistry.assets.some((trusted) =>
    (trusted.assetId === asset.id || trusted.sha256 === asset.sha256) && trusted.exportApproval === "pending")
}
export interface NewsletterAssetResolver {
  resolve(localReference: string): Promise<Uint8Array>
}
export class NewsletterAssetResolutionError extends Error {
  readonly name = "NewsletterAssetResolutionError"
  constructor(readonly assetId: string, readonly reason: string) {
    super(`newsletter asset ${assetId} cannot be resolved: ${reason}`)
  }
}
export function referencedDesignAssets(design: NewsletterDesignState, revision: number) {
  const snapshot = design.revisionHistory.find((entry) => entry.revision === revision)?.snapshot
  if (snapshot === undefined) throw new NewsletterAssetResolutionError("design", `revision ${revision} is missing`)
  const ids = new Set<string>()
  for (const card of snapshot.cardLayouts) {
    if (card.image.assetId !== undefined) ids.add(card.image.assetId)
    if ("editorial" in card) for (const image of card.editorial?.moduleImages ?? []) if (image.assetId !== undefined) ids.add(image.assetId)
    if ("brand" in card && card.brand !== undefined) {
      if (card.brand.mascot.assetId !== undefined) ids.add(card.brand.mascot.assetId)
      if (card.brand.seasonalDecoration?.assetId !== undefined) ids.add(card.brand.seasonalDecoration.assetId)
    }
  }
  for (const module of snapshot.a4Layout.modules) if (module.image.assetId !== undefined) ids.add(module.image.assetId)
  if ("brand" in snapshot.a4Layout && snapshot.a4Layout.brand !== undefined) {
    const brand = snapshot.a4Layout.brand
    if (brand.mascot.assetId !== undefined) ids.add(brand.mascot.assetId)
    if (brand.seasonalDecoration.assetId !== undefined) ids.add(brand.seasonalDecoration.assetId)
  }
  return [...ids].map((id) => {
    const asset = snapshot.assetManifest.find((candidate) => candidate.id === id)
    if (asset === undefined) throw new NewsletterAssetResolutionError(id, "manifest entry is missing")
    return asset
  })
}
async function digest(bytes: Uint8Array): Promise<string> {
  const buffer = new Uint8Array(bytes).buffer
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))].map((value) => value.toString(16).padStart(2,"0")).join("")
}
function dataUrl(bytes: Uint8Array, mediaType: string): string {
  let binary = ""
  for (const value of bytes) binary += String.fromCharCode(value)
  return `data:${mediaType};base64,${btoa(binary)}`
}
export async function resolveDesignAssets(design: NewsletterDesignState, revision: number, resolver?: NewsletterAssetResolver): Promise<ReadonlyMap<string,string>> {
  const sources = new Map<string,string>()
  for (const asset of referencedDesignAssets(design,revision)) {
    if (asset.approvalStatus !== "approved" || asset.localReference !== `asset:${asset.sha256}`) throw new NewsletterAssetResolutionError(asset.id,"asset approval or reference is invalid")
    if (asset.registry !== undefined && (asset.registry.usageScope !== "newsletter-output" || asset.registry.classification === "OFFICIAL_REFERENCE" || asset.registry.purpose === "reference")) throw new NewsletterAssetResolutionError(asset.id,"asset is not approved for rendering")
    const builtin = bundledMascotSource(asset.id)
    if (asset.id === OTTER_ASSET_ID && asset.sha256 !== OTTER_SHA256) throw new NewsletterAssetResolutionError(asset.id,"SHA-256 differs from approved bundle")
    let bytes: Uint8Array
    if (resolver !== undefined) bytes = await resolver.resolve(asset.localReference)
    else if (builtin !== undefined) {
      const response = await fetch(builtin)
      if (!response.ok) throw new NewsletterAssetResolutionError(asset.id,"bundled image could not be read")
      bytes = new Uint8Array(await response.arrayBuffer())
    } else throw new NewsletterAssetResolutionError(asset.id,"resolver is missing")
    if (await digest(bytes) !== asset.sha256) throw new NewsletterAssetResolutionError(asset.id,"SHA-256 differs from manifest")
    sources.set(asset.id,dataUrl(bytes,asset.mediaType))
  }
  return sources
}
