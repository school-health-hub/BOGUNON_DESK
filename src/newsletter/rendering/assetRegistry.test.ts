import { describe, expect, it } from "vitest"
import { createAssetRegistry, parseAssetRegistry, registerNewsletterAsset, reviseNewsletterAsset, toDesignAssetManifest } from "./assetRegistry"

const NOW = "2026-10-29T00:00:00.000Z"
const SHA = "a".repeat(64)

describe("Newsletter asset registry", () => {
  it("keeps reference material separate from output-approved assets", () => {
    // Given
    const registry = createAssetRegistry()

    // When
    const next = registerNewsletterAsset(registry, {
      assetId: "september-cover-reference",
      sha256: SHA,
      origin: "사용자 제공 2026년 9월 보건소식지",
      classification: "OFFICIAL_REFERENCE",
      purpose: "reference",
      approvalStatus: "reference-only",
      usageScope: "layout-comparison-only",
      originalReference: "asset:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      mediaType: "image/jpeg",
      originalName: "style-cover.jpg",
      now: NOW,
    })

    // Then
    expect(toDesignAssetManifest(next)).toEqual([])
    expect(next.assets[0]?.history).toEqual([{ revision: 1, changedAt: NOW, approvalStatus: "reference-only", usageScope: "layout-comparison-only" }])
  })

  it("exports only a file-level approved output asset and records later approval revisions", () => {
    // Given
    const registered = registerNewsletterAsset(createAssetRegistry(), {
      assetId: "otter-teacher",
      sha256: SHA,
      origin: "사용자 제작 AI 수달쌤",
      classification: "USER_CREATED",
      purpose: "mascot",
      approvalStatus: "pending",
      usageScope: "qa-only",
      originalReference: "asset:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      mediaType: "image/png",
      originalName: "otter-health-teacher.png",
      now: NOW,
    })

    // When
    const approved = reviseNewsletterAsset(registered, {
      assetId: "otter-teacher",
      approvalStatus: "approved",
      usageScope: "newsletter-output",
      now: "2026-10-30T00:00:00.000Z",
    })

    // Then
    expect(approved.assets[0]?.history).toHaveLength(2)
    expect(toDesignAssetManifest(approved)).toEqual([{ id: "otter-teacher", sha256: SHA, mediaType: "image/png", approvalStatus: "approved", originalName: "otter-health-teacher.png", localReference: `asset:${SHA}`, registry: { classification: "USER_CREATED", purpose: "mascot", usageScope: "newsletter-output" } }])
  })

  it("rejects a safe reference whose hash differs from the registered file", () => {
    expect(() => parseAssetRegistry({
      registryVersion: 1,
      assets: [{
        assetId: "mismatched-file",
        sha256: SHA,
        origin: "합성 테스트",
        classification: "AI_GENERATED",
        purpose: "illustration",
        approvalStatus: "pending",
        usageScope: "qa-only",
        originalReference: `asset:${"b".repeat(64)}`,
        mediaType: "image/png",
        originalName: "mismatch.png",
        history: [{ revision: 1, changedAt: NOW, approvalStatus: "pending", usageScope: "qa-only" }],
      }],
    })).toThrow(/reference must match/i)
  })
})

it("retains independent print approval through registry and manifest", () => {
  const registry = registerNewsletterAsset(createAssetRegistry(), {
    assetId: "print-pending", sha256: SHA, origin: "user", classification: "USER_CREATED",
    purpose: "mascot", approvalStatus: "approved", exportApproval: "pending",
    usageScope: "newsletter-output", originalReference: `asset:${SHA}`,
    mediaType: "image/png", originalName: "mascot.png", now: NOW,
  })
  expect(registry.assets[0]?.exportApproval).toBe("pending")
  expect(toDesignAssetManifest(registry)[0]?.exportApproval).toBe("pending")
  const revised = reviseNewsletterAsset(registry, { assetId: "print-pending", approvalStatus: "approved", usageScope: "newsletter-output", exportApproval: "approved", now: NOW })
  expect(revised.assets[0]?.exportApproval).toBe("approved")
  expect(revised.assets[0]?.history[1]?.exportApproval).toBe("approved")
})
