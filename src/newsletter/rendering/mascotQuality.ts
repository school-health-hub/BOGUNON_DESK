import { OTTER_ASSET_ID, OTTER_PIXEL_SIZE } from "./bundledMascot"
import type { RenderDocument } from "./renderDocument"

export function mascotEnlargementWarning(frame: { readonly width: number; readonly height: number }, outputScale: number): string | undefined {
  const scale = Math.min(frame.width / OTTER_PIXEL_SIZE.width, frame.height / OTTER_PIXEL_SIZE.height) * outputScale
  return scale > 1 ? `수달쌤 원본 1254×1254보다 ${scale.toFixed(2)}배 확대됩니다. 출력 선명도를 확인하세요.` : undefined
}

export function mascotQualityWarnings(document: RenderDocument): readonly string[] {
  const placements = [
    { pageId: "a4-page", image: document.a4.mascot, scale: 2 },
    ...document.cards.map((page) => ({ pageId: page.pageId, image: page.mascot, scale: 1.5 })),
  ]
  return placements.flatMap(({ pageId, image, scale }) => {
    if (image?.assetId !== OTTER_ASSET_ID) return []
    const warning = mascotEnlargementWarning(image.frame, scale)
    return warning === undefined ? [] : [`${pageId}: ${warning}`]
  })
}
