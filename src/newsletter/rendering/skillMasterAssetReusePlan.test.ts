import { describe, expect, it } from "vitest"
import { studentArtCatalog } from "./studentArtCatalog"
import { skillMasterAssetReusePlan, type ReusableIllustration } from "./skillMasterAssetReusePlan"

describe("skill master asset reuse plan", () => {
  it("covers six topics with one representative and four action slots", () => {
    expect(skillMasterAssetReusePlan).toHaveLength(6)
    expect(skillMasterAssetReusePlan.every(plan => plan.actions.length === 4)).toBe(true)
  })

  it("binds product-library entries to immutable catalog hashes", () => {
    const productAssets = skillMasterAssetReusePlan.flatMap(plan => [plan.representative, ...plan.actions])
      .filter((asset): asset is ReusableIllustration => asset.status !== "missing" && asset.source === "product-library")
    expect(productAssets.length).toBeGreaterThan(0)
    for (const asset of productAssets) {
      expect(studentArtCatalog.some(entry => entry.id === asset.assetId && entry.sha256 === asset.sha256)).toBe(true)
    }
  })

  it("keeps unsupported scenes explicit instead of substituting unrelated art", () => {
    const hygiene = skillMasterAssetReusePlan[0]
    const mentalHealth = skillMasterAssetReusePlan[3]
    expect(hygiene?.actions[1].status).toBe("missing")
    expect(hygiene?.actions[2].status).toBe("missing")
    expect(mentalHealth?.actions.every(asset => asset.status === "missing")).toBe(true)
  })
})
