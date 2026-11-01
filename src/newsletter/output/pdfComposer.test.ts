import { PDFDocument } from "pdf-lib"
import { describe, expect, it } from "vitest"
import { A4_PAGE_POINTS, CARD_PAGE_POINTS, PdfLibImageComposer } from "./pdfComposer"

const ONE_PIXEL_PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+7xM9WQAAAABJRU5ErkJggg=="), (character) => character.charCodeAt(0))

describe("Newsletter PDF composer", () => {
  it("creates one exact A4 page from a PNG", async () => {
    // Given
    const composer = new PdfLibImageComposer()

    // When
    const bytes = await composer.compose([{ pngBytes: ONE_PIXEL_PNG, pageSize: A4_PAGE_POINTS }])
    const pdf = await PDFDocument.load(bytes)

    // Then
    expect(pdf.getPageCount()).toBe(1)
    expect(pdf.getPage(0).getSize()).toEqual(A4_PAGE_POINTS)
  })

  it("creates exactly seven square six-inch pages", async () => {
    // Given
    const composer = new PdfLibImageComposer()
    const pages = Array.from({ length: 7 }, () => ({ pngBytes: ONE_PIXEL_PNG, pageSize: CARD_PAGE_POINTS }))

    // When
    const bytes = await composer.compose(pages)
    const pdf = await PDFDocument.load(bytes)

    // Then
    expect(pdf.getPageCount()).toBe(7)
    expect(pdf.getPages().every((page) => page.getWidth() === 432 && page.getHeight() === 432)).toBe(true)
  })
})
