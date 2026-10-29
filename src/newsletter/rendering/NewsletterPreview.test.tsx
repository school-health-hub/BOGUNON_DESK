// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { renderA4Svg, renderCardSvg } from "../output/svgRenderer"
import { createNewsletterDesignState } from "./designSchema"
import { upgradeNewsletterDesignStateV2 } from "./designState"
import { A4Preview, CardPreview } from "./NewsletterPreview"
import { compileRenderDocument } from "./renderDocument"
import { attachApprovedMascot, OTTER_ASSET_ID } from "./bundledMascot"
import { resolveDesignAssets } from "./assetResolution"

afterEach(cleanup)

describe("Newsletter preview scene binding", () => {
  it("renders the same registered source in preview and export", async () => {
    // Given
    const now = "2026-10-29T00:00:00.000Z"
    const project = await createNewsletterProject({ projectId: "project-1", title: "보건소식", now })
    const design = attachApprovedMascot(upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now), now)
    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: design.designRevision })
    const assets = await resolveDesignAssets(design, design.designRevision)
    const source = assets.get(OTTER_ASSET_ID)
    if (source === undefined) throw new Error("approved PNG source missing")
    // When
    const view = render(<A4Preview document={document} assets={assets} />)
    // Then
    expect([...view.container.querySelectorAll("image")].some((image) => image.getAttribute("href") === source)).toBe(true)
    expect(renderA4Svg(document.a4, assets)).toContain(source)
    for (const page of document.cards) {
      const cardView = render(<CardPreview page={page} assets={assets} />)
      expect([...cardView.container.querySelectorAll("image")].some((image) => image.getAttribute("href") === source)).toBe(true)
      expect(renderCardSvg(page, assets)).toContain(source)
    }
  })
  it("uses the exact page scene hash emitted by export SVG", async () => {
    const now = "2026-01-01T00:00:00.000Z"
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now })
    const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), "2026-01-02T00:00:00.000Z")
    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: 2 })

    render(<A4Preview document={document} />)
    const previewHash = screen.getByRole("img", { name: "A4 보건소식지 미리보기" }).getAttribute("data-scene-hash")
    const exportHash = /data-scene-hash="([a-f0-9]{64})"/u.exec(renderA4Svg(document.a4, new Map()))?.[1]

    expect(previewHash).toBe(exportHash)
  })

  it("namespaces image clip paths when before and current previews share a page id", async () => {
    // Given
    const now = "2026-01-01T00:00:00.000Z"
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now })
    const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), "2026-01-02T00:00:00.000Z")
    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: 2 })

    // When
    const view = render(<><A4Preview document={document} /><A4Preview document={document} /></>)
    const clipIds = [...view.container.querySelectorAll("clipPath")].map((clip) => clip.id)

    // Then
    expect(new Set(clipIds).size).toBe(clipIds.length)
  })
})
