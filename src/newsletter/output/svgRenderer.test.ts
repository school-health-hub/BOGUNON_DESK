import { describe, expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState } from "../rendering/designSchema"
import { compileRenderDocument } from "../rendering/renderDocument"
import { renderA4Svg, renderCardSvg, validateA4SafeArea } from "./svgRenderer"

const NOW = "2026-01-01T00:00:00.000Z"

describe("Newsletter SVG renderer", () => {
  it("keeps A4 content inside the ten-millimetre safe area and preserves Korean glyphs", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "project-1", title: "한글 보건소식", now: NOW })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW, schoolName: "합성고등학교" })
    const document = compileRenderDocument({ project, projectRevision: 1, design, designRevision: 1 })

    // When
    const svg = renderA4Svg(document.a4, new Map())

    // Then
    expect(validateA4SafeArea(document.a4)).toEqual([])
    expect(svg).toContain('viewBox="0 0 1240 1754"')
    expect(svg).toContain("한글 보건소식")
    expect(svg).toContain("합성고등학교")
  })

  it("renders card images with aspect-preserving clipping", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW })
    const page = compileRenderDocument({ project, projectRevision: 1, design, designRevision: 1 }).cards[0]
    if (page === undefined) throw new Error("test fixture has no cover card")

    // When
    const svg = renderCardSvg(page, new Map())

    // Then
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"')
    expect(svg).toContain('clipPath id="clip-card-cover-cover-image"')
  })
})
