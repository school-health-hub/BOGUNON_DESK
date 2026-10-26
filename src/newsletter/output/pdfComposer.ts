import { PDFDocument } from "pdf-lib"

export type PdfPageSize = {
  readonly width: number
  readonly height: number
}

export type PdfImagePage = {
  readonly pngBytes: Uint8Array
  readonly pageSize: PdfPageSize
}

export interface PdfComposer {
  compose(pages: readonly PdfImagePage[]): Promise<Uint8Array>
}

export const A4_PAGE_POINTS = { width: 595.275590551, height: 841.88976378 } as const
export const CARD_PAGE_POINTS = { width: 432, height: 432 } as const

export class PdfLibImageComposer implements PdfComposer {
  async compose(pages: readonly PdfImagePage[]): Promise<Uint8Array> {
    const document = await PDFDocument.create()
    for (const source of pages) {
      const image = await document.embedPng(source.pngBytes)
      const page = document.addPage([source.pageSize.width, source.pageSize.height])
      page.drawImage(image, { x: 0, y: 0, width: source.pageSize.width, height: source.pageSize.height })
    }
    return document.save()
  }
}
