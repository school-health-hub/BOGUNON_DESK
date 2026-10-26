import { PDFDocument } from "pdf-lib"
import { createNewsletterProject } from "../newsletter/project"
import { BrowserSvgRasterizer } from "../newsletter/output/browserRasterizer"
import { generateNewsletterOutputs, readPngDimensions } from "../newsletter/output/outputEngine"
import { PdfLibImageComposer } from "../newsletter/output/pdfComposer"
import { createNewsletterDesignState } from "../newsletter/rendering/designSchema"

type QaResult = {
  readonly status: "PASS"
  readonly fontReady: boolean
  readonly a4: { readonly width: number; readonly height: number; readonly bytes: number }
  readonly cards: readonly { readonly id: string; readonly width: number; readonly height: number; readonly bytes: number }[]
  readonly a4Pdf: { readonly header: string; readonly bytes: number; readonly pages: number; readonly width: number; readonly height: number }
  readonly cardsPdf: { readonly header: string; readonly bytes: number; readonly pages: number; readonly width: number; readonly height: number }
  readonly manifestOutputs: number
}

function resultElement(): HTMLElement {
  const element = document.querySelector<HTMLElement>("#result")
  if (element === null) throw new Error("output QA result element is missing")
  return element
}

async function run(): Promise<QaResult> {
  const now = "2026-01-01T00:00:00.000Z"
  const project = await createNewsletterProject({ projectId: "browser-qa", title: "한글 출력 검증", now })
  const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now, schoolName: "합성고등학교" })
  const bundle = await generateNewsletterOutputs({
    project,
    projectRevision: 1,
    design,
    designRevision: 1,
    createdAt: now,
    rasterizer: new BrowserSvgRasterizer(),
    pdfComposer: new PdfLibImageComposer(),
  })
  const a4Pdf = await PDFDocument.load(bundle.a4Pdf.bytes)
  const cardsPdf = await PDFDocument.load(bundle.cardsPdf.bytes)
  const a4Page = a4Pdf.getPage(0)
  const cardPage = cardsPdf.getPage(0)
  return {
    status: "PASS",
    fontReady: document.fonts.check("500 16px Pretendard", "한글"),
    a4: { ...readPngDimensions(bundle.a4Png.bytes), bytes: bundle.a4Png.bytes.length },
    cards: bundle.cardPngs.map((card) => ({ id: card.stableId, ...readPngDimensions(card.bytes), bytes: card.bytes.length })),
    a4Pdf: { header: new TextDecoder().decode(bundle.a4Pdf.bytes.slice(0, 5)), bytes: bundle.a4Pdf.bytes.length, pages: a4Pdf.getPageCount(), ...a4Page.getSize() },
    cardsPdf: { header: new TextDecoder().decode(bundle.cardsPdf.bytes.slice(0, 5)), bytes: bundle.cardsPdf.bytes.length, pages: cardsPdf.getPageCount(), ...cardPage.getSize() },
    manifestOutputs: bundle.manifest.outputs.length,
  }
}

run().then(
  (result) => { resultElement().textContent = JSON.stringify(result, null, 2) },
  (error: unknown) => { resultElement().textContent = `FAIL\n${error instanceof Error ? error.message : String(error)}` },
)
