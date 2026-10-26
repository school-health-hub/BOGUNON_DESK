// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { renderA4Svg } from "../output/svgRenderer"
import { createNewsletterDesignState } from "./designSchema"
import { upgradeNewsletterDesignStateV2 } from "./designState"
import { A4Preview } from "./NewsletterPreview"
import { compileRenderDocument } from "./renderDocument"

afterEach(cleanup)

describe("Newsletter preview scene binding", () => {
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
})
