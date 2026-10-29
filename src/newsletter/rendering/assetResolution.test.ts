import { describe, expect, it, vi } from "vitest"
import { createNewsletterDesignState } from "./designSchema"
import { upgradeNewsletterDesignStateV2 } from "./designState"
import { attachApprovedMascot, OTTER_ASSET_ID } from "./bundledMascot"
import { assetExportPending, resolveDesignAssets } from "./assetResolution"
const NOW = "2026-10-29T00:00:00.000Z"
describe("scene asset resolution", () => {
  it("resolves one bundled image shared by all eight brand frames", async () => {
    // Given
    const design = attachApprovedMascot(upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:"asset-resolution",canonicalProjectRevision:1,now:NOW}),NOW),NOW)
    // When
    const sources = await resolveDesignAssets(design,design.designRevision)
    // Then
    expect(sources.size).toBe(1)
    expect(sources.get(OTTER_ASSET_ID)).toMatch(/^data:image\/png;base64,/)
  })
  it("rejects different bytes returned for an approved bundled asset", async () => {
    // Given
    const design = attachApprovedMascot(upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:"asset-resolution",canonicalProjectRevision:1,now:NOW}),NOW),NOW)
    const resolve = vi.fn(async () => new Uint8Array([1,2,3]))
    // When
    const result = resolveDesignAssets(design,design.designRevision,{resolve})
    // Then
    await expect(result).rejects.toThrow(/SHA-256/)
    expect(resolve).toHaveBeenCalledTimes(1)
  })
})

it("preserves legacy export eligibility for unrelated hashes while trusting the approved mascot ledger",()=>{
  // Given
  const design=attachApprovedMascot(upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:"policy",canonicalProjectRevision:1,now:NOW}),NOW),NOW)
  const asset=design.assetManifest[0]
  if(asset===undefined) throw new Error("fixture asset missing")
  const {exportApproval:omitted,...legacy}=asset
  // When
  const states=[assetExportPending({...legacy,id:"unrelated-image",sha256:"a".repeat(64)}),assetExportPending({...legacy,id:"imported-otter",exportApproval:"approved"})]
  // Then
  expect(states).toEqual([false,true])
})
