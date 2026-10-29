import { describe, expect, it, vi } from "vitest"
import { updateCardLayout, upgradeNewsletterDesignStateV2 } from "../rendering/designState"
import { createNewsletterDesignState, parseNewsletterDesignStateV2, type NewsletterDesignStateV2 } from "../rendering/designSchema"
import { createNewsletterProject } from "../project"
import { NewsletterOutputBlockedError, generateNewsletterOutputs, readPngDimensions, type PdfComposer, type SvgRasterizer } from "./outputEngine"
import { attachApprovedMascot } from "../rendering/bundledMascot"
import type { PdfImagePage } from "./pdfComposer"

const NOW = "2026-01-01T00:00:00.000Z"

function safeDesign(projectId: string): NewsletterDesignStateV2 {
  return upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId, canonicalProjectRevision: 1, now: NOW, schoolName: "합성고등학교" }), "2026-01-01T00:00:01.000Z")
}

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
  it("keeps V1 readable but blocks its known overlapping layout with repair reasons", async () => {
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW })
    const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now: NOW })
    const rasterizer = testRasterizer()

    const output = generateNewsletterOutputs({ project, projectRevision: 1, design, designRevision: 1, createdAt: NOW, rasterizer, pdfComposer: testPdfComposer() })

    await expect(output).rejects.toMatchObject({ name: "NewsletterOutputBlockedError", reasons: expect.arrayContaining([expect.stringContaining("layout-collision")]) })
    expect(rasterizer.ensureFontReady).not.toHaveBeenCalled()
  })

  it("generates atomic A4 and seven-card artifacts with revision-bound hashes", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW })
    const design = safeDesign(project.projectId)
    const rasterizer = testRasterizer()

    // When
    const bundle = await generateNewsletterOutputs({ project, projectRevision: 1, design, designRevision: 2, createdAt: NOW, rasterizer, pdfComposer: testPdfComposer() })

    // Then
    expect(bundle.a4Png.fileName).toBe("newsletter-a4.png")
    expect(readPngDimensions(bundle.a4Png.bytes)).toEqual({ width: 2480, height: 3508 })
    expect(bundle.cardPngs).toHaveLength(7)
    expect(bundle.cardPngs.map((artifact) => artifact.stableId)).toEqual(design.cardLayouts.map((card) => card.pageId))
    expect(bundle.cardPngs.every((artifact) => readPngDimensions(artifact.bytes).width === 1800)).toBe(true)
    expect(bundle.manifest.projectRevision).toBe(1)
    expect(bundle.manifest.designRevision).toBe(2)
    expect(bundle.manifest.outputs.every((output) => output.sha256.length === 64)).toBe(true)
    expect(bundle.manifest.outputs.find((output) => output.outputType === "a4-png")?.pixelSize).toEqual({ width: 2480, height: 3508 })
  })

  it("keeps non-target card PNG hashes stable after one card layout edit", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW })
    const design = safeDesign(project.projectId)
    const changed = updateCardLayout(design, { cardIndex: 3, patch: { background: "#fff4dc" }, now: "2026-01-02T00:00:00.000Z" })

    // When
    const before = await generateNewsletterOutputs({ project, projectRevision: 1, design, designRevision: 2, createdAt: NOW, rasterizer: testRasterizer(), pdfComposer: testPdfComposer() })
    const after = await generateNewsletterOutputs({ project, projectRevision: 1, design: changed, designRevision: 3, createdAt: NOW, rasterizer: testRasterizer(), pdfComposer: testPdfComposer() })

    // Then
    expect(after.cardPngs.map((card) => card.sha256)).toEqual(before.cardPngs.map((card, index) => index === 3 ? after.cardPngs[index]?.sha256 : card.sha256))
  })

  it("blocks overflow before font loading or artifact publication", async () => {
    // Given
    const longText = "필수 보건정보를 생략하지 않는 매우 긴 한글 문장 ABC-123 ".repeat(80)
    const project = await createNewsletterProject({ projectId: "project-1", title: longText, now: NOW })
    const design = safeDesign(project.projectId)
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
    const design = safeDesign(project.projectId)
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
    const output = generateNewsletterOutputs({ project, projectRevision: 1, design, designRevision: 2, createdAt: NOW, rasterizer, pdfComposer: composer })

    // Then
    await expect(output).rejects.toThrow("synthetic raster failure")
    expect(composer.compose).not.toHaveBeenCalled()
  })

  it("cancels before rasterization without composing partial PDFs", async () => {
    const project = await createNewsletterProject({ projectId: "project-1", title: "합성 보건소식", now: NOW })
    const design = safeDesign(project.projectId)
    const rasterizer = testRasterizer()
    const composer = testPdfComposer()
    const controller = new AbortController()
    controller.abort()

    const output = generateNewsletterOutputs({
      project,
      projectRevision: 1,
      design,
      designRevision: 2,
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

describe("mascot output approval", () => {
  it("blocks print-pending mascot in publication before rasterizing", async () => {
    // Given
    const project = await createNewsletterProject({projectId:"mascot-output",title:"보건소식",now:NOW})
    const design = attachApprovedMascot(safeDesign(project.projectId),NOW)
    const rasterizer = testRasterizer()
    // When
    const result = generateNewsletterOutputs({project,projectRevision:1,design,designRevision:design.designRevision,createdAt:NOW,rasterizer,pdfComposer:testPdfComposer()})
    // Then
    await expect(result).rejects.toThrow(/print approval pending/)
    expect(rasterizer.ensureFontReady).not.toHaveBeenCalled()
  })
  it("marks QA output and embeds the same verified PNG in every scene", async () => {
    // Given
    const project = await createNewsletterProject({projectId:"mascot-output",title:"보건소식",now:NOW})
    const design = attachApprovedMascot(safeDesign(project.projectId),NOW)
    const svgs:string[] = []
    const rasterizer:SvgRasterizer = {ensureFontReady:async()=>undefined,rasterize:async({svg,width,height})=>{svgs.push(svg);return syntheticPng(width,height,svg)}}
    // When
    const result = await generateNewsletterOutputs({project,projectRevision:1,design,designRevision:design.designRevision,createdAt:NOW,rasterizer,pdfComposer:testPdfComposer(),purpose:"qa"})
    // Then
    expect(result.manifest.reviewOnly).toBe(true)
    expect(svgs).toHaveLength(8)
    expect(svgs.every(svg=>svg.includes("data:image/png;base64,"))).toBe(true)
  })
})

it("does not let QA mode bypass rejected asset approval", async () => {
  // Given
  const project = await createNewsletterProject({projectId:"mascot-rejected",title:"보건소식",now:NOW})
  const approved = attachApprovedMascot(safeDesign(project.projectId),NOW)
  const assetManifest = approved.assetManifest.map(asset=>({...asset,approvalStatus:"rejected" as const}))
  const design = parseNewsletterDesignStateV2({...approved,assetManifest,revisionHistory:approved.revisionHistory.map(entry=>entry.revision===approved.designRevision?{...entry,snapshot:{...entry.snapshot,assetManifest}}:entry)})
  const rasterizer = testRasterizer()
  // When
  const result = generateNewsletterOutputs({project,projectRevision:1,design,designRevision:design.designRevision,createdAt:NOW,rasterizer,pdfComposer:testPdfComposer(),purpose:"qa"})
  // Then
  await expect(result).rejects.toMatchObject({name:"RenderAssetNotApprovedError"})
  expect(rasterizer.ensureFontReady).not.toHaveBeenCalled()
})

it.each([undefined,"approved"] as const)("blocks imported mascot publication when exportApproval is %s",async(exportApproval)=>{
  // Given
  const project=await createNewsletterProject({projectId:"imported-mascot",title:"보건소식",now:NOW})
  const original=attachApprovedMascot(safeDesign(project.projectId),NOW)
  const assetManifest=original.assetManifest.map(({exportApproval: omitted,...asset})=>({...asset,...(exportApproval===undefined?{}:{exportApproval})}))
  const design=parseNewsletterDesignStateV2({...original,assetManifest,revisionHistory:original.revisionHistory.map(entry=>entry.revision===original.designRevision?{...entry,snapshot:{...entry.snapshot,assetManifest}}:entry)})
  const rasterizer=testRasterizer()
  // When
  const output=generateNewsletterOutputs({project,projectRevision:1,design,designRevision:design.designRevision,createdAt:NOW,rasterizer,pdfComposer:testPdfComposer()})
  // Then
  await expect(output).rejects.toThrow(/print approval pending/)
  expect(rasterizer.ensureFontReady).not.toHaveBeenCalled()
})

it("blocks the trusted mascot hash imported under an alias before resolver access",async()=>{
  // Given
  const project=await createNewsletterProject({projectId:"aliased-mascot",title:"보건소식",now:NOW})
  const original=attachApprovedMascot(safeDesign(project.projectId),NOW)
  const imported=parseNewsletterDesignStateV2(JSON.parse(JSON.stringify(original).split('"otter-primary-v1"').join('"imported-otter"').split('"exportApproval":"pending"').join('"exportApproval":"approved"')))
  const resolve=vi.fn(async()=>new Uint8Array())
  // When
  const output=generateNewsletterOutputs({project,projectRevision:1,design:imported,designRevision:imported.designRevision,createdAt:NOW,rasterizer:testRasterizer(),pdfComposer:testPdfComposer(),assetResolver:{resolve}})
  // Then
  await expect(output).rejects.toThrow(/print approval pending/)
  expect(resolve).not.toHaveBeenCalled()
})

it.each([undefined,"approved"] as const)("allows reviewed QA generation when imported exportApproval is %s",async(exportApproval)=>{
  // Given
  const project=await createNewsletterProject({projectId:"qa-imported-mascot",title:"보건소식",now:NOW})
  const original=attachApprovedMascot(safeDesign(project.projectId),NOW)
  const assetManifest=original.assetManifest.map(({exportApproval: omitted,...asset})=>({...asset,...(exportApproval===undefined?{}:{exportApproval})}))
  const design=parseNewsletterDesignStateV2({...original,assetManifest,revisionHistory:original.revisionHistory.map(entry=>entry.revision===original.designRevision?{...entry,snapshot:{...entry.snapshot,assetManifest}}:entry)})
  const rasterizer:SvgRasterizer={ensureFontReady:async()=>undefined,rasterize:async({width,height})=>syntheticPng(width,height,"qa")}
  // When
  const output=await generateNewsletterOutputs({project,projectRevision:1,design,designRevision:design.designRevision,createdAt:NOW,rasterizer,pdfComposer:testPdfComposer(),purpose:"qa"})
  // Then
  expect(output.manifest.reviewOnly).toBe(true)
  expect(output.cardPngs).toHaveLength(7)
})
