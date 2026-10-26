import type { RenderDocument, RenderPage, RenderTextBlock } from "../rendering/renderDocument"

type A4Page = RenderDocument["a4"]
type Frame = RenderTextBlock["frame"]

export class SvgAssetMissingError extends Error {
  readonly name = "SvgAssetMissingError"
  constructor(readonly assetId: string) {
    super(`resolved asset is missing: ${assetId}`)
  }
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}

function textAnchor(block: RenderTextBlock): { readonly anchor: "start" | "middle" | "end"; readonly x: number } {
  switch (block.style.align) {
    case "left":
      return { anchor: "start", x: block.frame.x }
    case "center":
      return { anchor: "middle", x: block.frame.x + block.frame.width / 2 }
    case "right":
      return { anchor: "end", x: block.frame.x + block.frame.width }
  }
}

function renderText(block: RenderTextBlock): string {
  const horizontal = textAnchor(block)
  const lineHeight = block.style.fontSize * block.style.lineHeight
  const spans = block.lines.map((line, index) => `<tspan x="${horizontal.x}" y="${block.frame.y + block.style.fontSize + index * lineHeight}">${escapeXml(line)}</tspan>`).join("")
  return `<text id="${escapeXml(block.id)}" font-family="Pretendard" font-size="${block.style.fontSize}" font-weight="${block.style.fontWeight}" fill="${block.style.color}" text-anchor="${horizontal.anchor}">${spans}</text>`
}

function placeholderDataUrl(): string {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23e7ece9'/%3E%3Cpath d='M16 42l10-12 8 8 7-9 9 13z' fill='%2399aaa2'/%3E%3C/svg%3E"
}

function renderImage(pageId: string, image: RenderPage["image"], assets: ReadonlyMap<string, string>): string {
  const clipId = `clip-${pageId}-${image.slotId}`
  const source = image.assetId === undefined ? placeholderDataUrl() : assets.get(image.assetId)
  if (source === undefined && image.assetId !== undefined) throw new SvgAssetMissingError(image.assetId)
  const frame = image.frame
  const aspect = image.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"
  return `<defs><clipPath id="${clipId}"><rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" rx="12"/></clipPath></defs><image href="${escapeXml(source ?? placeholderDataUrl())}" x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" preserveAspectRatio="${aspect}" clip-path="url(#${clipId})"/>`
}

function frameInside(frame: Frame, margin: number, width: number, height: number): boolean {
  return frame.x >= margin && frame.y >= margin && frame.x + frame.width <= width - margin && frame.y + frame.height <= height - margin
}

export function validateA4SafeArea(page: A4Page): readonly string[] {
  const frames: readonly { readonly id: string; readonly frame: Frame }[] = [
    { id: page.title.id, frame: page.title.frame },
    { id: page.publicationMeta.id, frame: page.publicationMeta.frame },
    { id: page.footer.id, frame: page.footer.frame },
    ...page.modules.flatMap((module) => [
      { id: module.title.id, frame: module.title.frame },
      { id: module.body.id, frame: module.body.frame },
      { id: module.image.slotId, frame: module.image.frame },
    ]),
  ]
  return frames.filter(({ frame }) => !frameInside(frame, page.safeMargin, page.width, page.height)).map(({ id }) => id)
}

export function renderCardSvg(page: RenderPage, assets: ReadonlyMap<string, string>): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${page.width} ${page.height}" width="${page.width}" height="${page.height}"><rect width="100%" height="100%" fill="${page.background}"/>${renderImage(page.pageId, page.image, assets)}${renderText(page.title)}${renderText(page.body)}</svg>`
}

export function renderA4Svg(page: A4Page, assets: ReadonlyMap<string, string>): string {
  const modules = page.modules.map((module) => `<g id="${escapeXml(module.sectionId)}"><rect x="${module.title.frame.x - 12}" y="${module.title.frame.y - 12}" width="${module.body.frame.width + 24}" height="${module.body.frame.y + module.body.frame.height - module.title.frame.y + 24}" rx="18" fill="#ffffff" stroke="#d8e2dc"/>${renderImage(page.pageId, module.image, assets)}${renderText(module.title)}${renderText(module.body)}</g>`).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${page.width} ${page.height}" width="${page.width}" height="${page.height}"><rect width="100%" height="100%" fill="${page.background}"/>${renderText(page.title)}${renderText(page.publicationMeta)}${modules}${renderText(page.footer)}</svg>`
}
