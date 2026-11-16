// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"
import { BrowserSvgRasterizer } from "./browserRasterizer"

describe("BrowserSvgRasterizer font loading", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("loads the page font from the current origin while keeping the QA CSP strict", async () => {
    // Given
    let fontSource = ""
    class TestFontFace {
      constructor(_family: string, source: string) {
        fontSource = source
      }

      async load(): Promise<TestFontFace> {
        return this
      }
    }
    vi.stubGlobal("FontFace", TestFontFace)
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: {
        add: vi.fn(),
        check: vi.fn(() => true),
        ready: Promise.resolve(),
      },
    })

    // When
    await new BrowserSvgRasterizer().ensureFontReady()

    // Then
    const match = /^url\("(.+)"\)$/u.exec(fontSource)
    expect(match).not.toBeNull()
    const loadedUrl = new URL(match?.[1] ?? "invalid:")
    expect(loadedUrl.origin).toBe(window.location.origin)
    expect(loadedUrl.pathname).toMatch(/PretendardVariable.*\.woff2$/u)
    expect(fontSource).not.toContain("data:")
  })
})

describe("BrowserSvgRasterizer under the product image policy", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL(): string { return "blob:qa-policy-rejected" }
      static revokeObjectURL(): void {}
    })
  })
  it("uses a UTF-8 data image allowed by strict CSP and produces PNG bytes", async () => {
    // Given: blob images are not allowed by the Workspace policy.
    const source = '<svg xmlns="http://www.w3.org/2000/svg"><text>11월 &amp; 건강 #1</text></svg>'
    let decodedSvg = ""
    class PolicyImage {
      decoding = "auto"
      src = ""
      async decode(): Promise<void> {
        if (!this.src.startsWith("data:image/svg+xml;charset=utf-8,")) throw new DOMException("Blocked image source", "EncodingError")
        decodedSvg = decodeURIComponent(this.src.slice(this.src.indexOf(",") + 1))
      }
    }
    vi.stubGlobal("Image", PolicyImage)
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    const png = new Uint8Array([137, 80, 78, 71])
    const create = document.createElement.bind(document)
    vi.spyOn(document, "createElement").mockImplementation((name, options) => {
      const element = create(name, options)
      if (element instanceof HTMLCanvasElement) {
        Object.defineProperty(element, "getContext", { value: () => ({ drawImage: vi.fn() }) })
        Object.defineProperty(element, "toBlob", { value: (done: BlobCallback) => done(Object.defineProperty(new Blob(), "arrayBuffer", { value: async () => png.buffer })) })
      }
      return element
    })
    // When
    const result = await new BrowserSvgRasterizer().rasterize({ svg: source, width: 100, height: 100 })
    // Then
    expect(result).toEqual(png)
    expect(decodedSvg).toContain('<text>11월 &amp; 건강 #1</text>')
    expect(decodedSvg).toContain("@font-face")
  })

  it("rejects decode failure without returning successful output bytes", async () => {
    // Given
    class BrokenImage {
      decoding = "auto"
      src = ""
      async decode(): Promise<void> { throw new DOMException("Invalid SVG", "EncodingError") }
    }
    vi.stubGlobal("Image", BrokenImage)
    // When / Then
    await expect(new BrowserSvgRasterizer().rasterize({ svg: '<svg/>', width: 100, height: 100 })).rejects.toThrow("Invalid SVG")
  })
})
