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
