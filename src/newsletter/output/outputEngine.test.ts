import { describe, expect, it, vi } from "vitest"
import { updateCardLayout } from "../rendering/designState"
import { createNewsletterDesignState } from "../rendering/designSchema"
import { createNewsletterProject } from "../project"
import { NewsletterOutputBlockedError, generateNewsletterOutputs, readPngDimensions, type PdfComposer, type SvgRasterizer } from "./outputEngine"
import type { PdfImagePage } from "./pdfComposer"

const NOW = "2026-01-01T00:00:00.000Z"

function syntheticPng(width: number, height: number, payload: string): Uint8Array {
  const bytes = new Uint8Array(24 + new TextEncoder().encode(payload).length)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  bytes.set(new TextEncoder().encode(payload), 24)
  return bytes
}

function testRasterizer(): SvgRasterizer {
  return {
    ensureFontReady: vi.fn(async () => undefined),
    rasterize: vi.fn(async ({ svg, width, height }) => syntheticPng(width, height, svg)),
  }
}

function testPdfComposer(): PdfComposer {
  return {
    compose: vi.fn(async (pages: readonly PdfImagePage[]) => new TextEncoder().encode(pages.map((page) => `${page.pageSize.width}x${page.pageSize.height}`).join("|"))),
  }
}

describe("Newsletter output engine", () => {
  it("generates atomic A4 and seven-card artifacts with revision-bound hashes", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW, schoolName: "합성고등학교" })
    const rasterizer = testRasterizer()

    // When
    const bundle = await generateNewsletterOutputs({ project, projectRevision: 1, design, designRevision: 1, createdAt: NOW, rasterizer, pdfComposer: testPdfComposer() })

    // Then
    expect(bundle.a4Png.fileName).toBe("newsletter-a4.png")
    expect(readPngDimensions(bundle.a4Png.bytes)).toEqual({ width: 2480, height: 3508 })
    expect(bundle.cardPngs).toHaveLength(7)
    expect(bundle.cardPngs.map((artifact) => artifact.stableId)).toEqual(design.cardLayouts.map((card) => card.pageId))
    expect(bundle.cardPngs.every((artifact) => readPngDimensions(artifact.bytes).width === 1800)).toBe(true)
    expect(bundle.manifest.projectRevision).toBe(1)
    expect(bundle.manifest.designRevision).toBe(1)
    expect(bundle.manifest.outputs.every((output) => output.sha256.length === 64)).toBe(true)
    expect(bundle.manifest.outputs.find((output) => output.outputType === "a4-png")?.pixelSize).toEqual({ width: 2480, height: 3508 })
  })

  it("keeps non-target card PNG hashes stable after one card layout edit", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW })
    const changed = updateCardLayout(design, { cardIndex: 3, patch: { background: "#fff4dc" }, now: "2026-01-02T00:00:00.000Z" })

    // When
    const before = await generateNewsletterOutputs({ project, projectRevision: 1, design, designRevision: 1, createdAt: NOW, rasterizer: testRasterizer(), pdfComposer: testPdfComposer() })
    const after = await generateNewsletterOutputs({ project, projectRevision: 1, design: changed, designRevision: 2, createdAt: NOW, rasterizer: testRasterizer(), pdfComposer: testPdfComposer() })

    // Then
    expect(after.cardPngs.map((card) => card.sha256)).toEqual(before.cardPngs.map((card, index) => index === 3 ? after.cardPngs[index]?.sha256 : card.sha256))
  })

  it("blocks overflow before font loading or artifact publication", async () => {
    // Given
    const longText = "필수 보건정보를 생략하지 않는 매우 긴 한글 문장 ABC-123 ".repeat(80)
    const project = await createNewsletterProject({ projectId: "project-1", title: longText, now: NOW })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW })
    const rasterizer = testRasterizer()

    // When
    const output = generateNewsletterOutputs({ project, projectRevision: 1, design, designRevision: 1, createdAt: NOW, rasterizer, pdfComposer: testPdfComposer() })

    // Then
    await expect(output).rejects.toBeInstanceOf(NewsletterOutputBlockedError)
    expect(rasterizer.ensureFontReady).not.toHaveBeenCalled()
  })

  it("returns no partial bundle when rasterization fails", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW })
    let calls = 0
    const rasterizer: SvgRasterizer = {
      ensureFontReady: async () => undefined,
      rasterize: async ({ svg, width, height }) => {
        calls += 1
        if (calls === 3) throw new Error("synthetic raster failure")
        return syntheticPng(width, height, svg)
      },
    }
    const composer = testPdfComposer()

    // When
    const output = generateNewsletterOutputs({ project, projectRevision: 1, design, designRevision: 1, createdAt: NOW, rasterizer, pdfComposer: composer })

    // Then
    await expect(output).rejects.toThrow("synthetic raster failure")
    expect(composer.compose).not.toHaveBeenCalled()
  })

  it("cancels before rasterization without composing partial PDFs", async () => {
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW })
    const rasterizer = testRasterizer()
    const composer = testPdfComposer()
    const controller = new AbortController()
    controller.abort()

    const output = generateNewsletterOutputs({
      project,
      projectRevision: 1,
      design,
      designRevision: 1,
      createdAt: NOW,
      rasterizer,
      pdfComposer: composer,
      signal: controller.signal,
    })

    await expect(output).rejects.toMatchObject({ name: "AbortError" })
    expect(rasterizer.ensureFontReady).not.toHaveBeenCalled()
    expect(composer.compose).not.toHaveBeenCalled()
  })
})
