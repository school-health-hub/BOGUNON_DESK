import type { RasterizeRequest, SvgRasterizer } from "./outputEngine"
import pretendardFontDataUrl from "../rendering/fonts/PretendardVariable.woff2?inline"

export class NewsletterFontUnavailableError extends Error {
  readonly name = "NewsletterFontUnavailableError"
  constructor() {
    super("Pretendard font is not ready for newsletter output")
  }
}

export class NewsletterRasterizationError extends Error {
  readonly name = "NewsletterRasterizationError"
  constructor(readonly reason: string) {
    super(`newsletter rasterization failed: ${reason}`)
  }
}

function abortIfNeeded(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new DOMException("Newsletter output was cancelled", "AbortError")
}

function canvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new NewsletterRasterizationError("canvas did not produce PNG bytes"))
        return
      }
      blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject)
    }, "image/png")
  })
}

export class BrowserSvgRasterizer implements SvgRasterizer {
  private fontReady = false

  async ensureFontReady(): Promise<void> {
    if (!this.fontReady) {
      const face = new FontFace("Pretendard", `url(${pretendardFontDataUrl})`, { weight: "100 900" })
      await face.load()
      document.fonts.add(face)
      await document.fonts.ready
      this.fontReady = true
    }
    if (!document.fonts.check("500 16px Pretendard", "한글")) throw new NewsletterFontUnavailableError()
  }

  async rasterize(request: RasterizeRequest): Promise<Uint8Array> {
    abortIfNeeded(request.signal)
    const fontStyle = `<style>@font-face{font-family:Pretendard;src:url(${pretendardFontDataUrl}) format('woff2');font-weight:100 900;font-style:normal}</style>`
    const svg = request.svg.replace(">", `>${fontStyle}`)
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }))
    try {
      const image = new Image()
      image.decoding = "sync"
      image.src = url
      await image.decode()
      abortIfNeeded(request.signal)
      const canvas = document.createElement("canvas")
      canvas.width = request.width
      canvas.height = request.height
      const context = canvas.getContext("2d")
      if (context === null) throw new NewsletterRasterizationError("2D canvas context is unavailable")
      context.drawImage(image, 0, 0, request.width, request.height)
      return await canvasPng(canvas)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}
