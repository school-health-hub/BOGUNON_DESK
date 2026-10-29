import { describe, expect, it } from "vitest"
import { createNewsletterDesignState, parseNewsletterDesignStateV2 } from "./designSchema"
import type { DesignSnapshotV2, NewsletterDesignStateV2 } from "./designSchema"
import { upgradeNewsletterDesignStateV2 } from "./designState"
import { attachApprovedMascot, bundledMascotRegistry, bundledMascotSource, OTTER_ASSET_ID, OTTER_SHA256, BundledMascotConflictError, BundledMascotBrandMissingError } from "./bundledMascot"

const NOW = "2026-10-29T00:00:00.000Z"
function fixture(): NewsletterDesignStateV2 {
  return upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "otter-test", canonicalProjectRevision: 1, now: NOW }), NOW)
}
function withManifest(design: NewsletterDesignStateV2, assetManifest: DesignSnapshotV2["assetManifest"]): NewsletterDesignStateV2 {
  return parseNewsletterDesignStateV2({ ...design, assetManifest, revisionHistory: design.revisionHistory.map((entry, index) => index === design.revisionHistory.length - 1 ? { ...entry, snapshot: { ...entry.snapshot, assetManifest } } : entry) })
}
describe("approved bundled mascot", () => {
  it("binds eight independent frames with one asset and preserves historical snapshots", () => {
    const design = fixture()
    const history = JSON.stringify(design.revisionHistory)
    const result = attachApprovedMascot(design, NOW)
    expect(result.assetManifest).toHaveLength(1)
    expect(result.a4Layout.brand?.mascot.assetId).toBe(OTTER_ASSET_ID)
    expect(result.cardLayouts.map((card) => card.brand?.mascot.assetId)).toEqual(Array(7).fill(OTTER_ASSET_ID))
    expect(result.a4Layout.brand?.mascot.frame).toEqual(design.a4Layout.brand?.mascot.frame)
    expect(result.cardLayouts.map((card) => card.brand?.mascot.frame)).toEqual(design.cardLayouts.map((card) => card.brand?.mascot.frame))
    expect(JSON.stringify(result.revisionHistory.slice(0, -1))).toBe(history)
    expect(result.designRevision).toBe(design.designRevision + 1)
    expect(attachApprovedMascot(result, NOW)).toBe(result)
  })
  it("records approved rendering and pending output QA for the exact approved binary", async () => {
    const source = bundledMascotSource(OTTER_ASSET_ID)
    if (source === undefined) throw new Error("bundled asset missing")
    const bytes = new Uint8Array(await (await fetch(source)).arrayBuffer())
    expect([...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((value) => value.toString(16).padStart(2, "0")).join("")).toBe(OTTER_SHA256)
    expect(new DataView(bytes.buffer).getUint32(16)).toBe(1254)
    expect(new DataView(bytes.buffer).getUint32(20)).toBe(1254)
    expect(bytes[25]).toBe(6)
    expect(bundledMascotRegistry.assets[0]).toMatchObject({ classification: "USER_CREATED", purpose: "mascot", approvalStatus: "approved", exportApproval: "pending" })
    expect(bundledMascotSource(OTTER_ASSET_ID)).toMatch(/^data:image\/png;base64,/)
    expect(bundledMascotSource("unknown")).toBeUndefined()
  })
  it("rejects duplicate bytes under another id", () => {
    const bound = attachApprovedMascot(fixture(), NOW)
    const design = withManifest(fixture(), bound.assetManifest.map((asset) => ({ ...asset, id: "another-otter" })))
    expect(() => attachApprovedMascot(design, NOW)).toThrow(BundledMascotConflictError)
  })
  it("rejects id collisions with different bytes", () => {
    const bound = attachApprovedMascot(fixture(), NOW)
    const sha256 = "a".repeat(64)
    const design = withManifest(fixture(), bound.assetManifest.map((asset) => ({ ...asset, sha256, localReference: `asset:${sha256}` })))
    expect(() => attachApprovedMascot(design, NOW)).toThrow(BundledMascotConflictError)
  })
  it("keeps old V2 without brand readable and requires explicit brand preparation", () => {
    const design = fixture()
    const a4Layout = { ...design.a4Layout, brand: undefined }
    const legacy = parseNewsletterDesignStateV2({ ...design, a4Layout, revisionHistory: design.revisionHistory.map((entry, index) => index === design.revisionHistory.length - 1 ? { ...entry, snapshot: { ...entry.snapshot, a4Layout } } : entry) })
    expect(() => attachApprovedMascot(legacy, NOW)).toThrow(BundledMascotBrandMissingError)
    expect(design.revisionHistory[0]?.snapshotVersion).toBe(1)
    expect(design.revisionHistory[0]?.snapshot.assetManifest).toEqual([])
  })
})


it("rejects imported print approval that conflicts with the trusted bundled approval", () => {
  const bound = attachApprovedMascot(fixture(), NOW)
  for (const exportApproval of [undefined, "approved"] as const) {
    const design = withManifest(fixture(), bound.assetManifest.map((asset) => ({ ...asset, exportApproval })))
    expect(() => attachApprovedMascot(design, NOW)).toThrow(BundledMascotConflictError)
  }
})
