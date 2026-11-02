import type { Frame } from "./renderDocument"

export type ImagePolygon = { readonly sourceWidth: number; readonly sourceHeight: number; readonly points: readonly { readonly x: number; readonly y: number }[] }
// Normalized source coordinates follow the same centered contain/cover transform as <image>.
export function imagePolygonPoints(frame: Frame, fit: "contain" | "cover", polygon: ImagePolygon): string {
  const scale = fit === "cover" ? Math.max(frame.width / polygon.sourceWidth, frame.height / polygon.sourceHeight) : Math.min(frame.width / polygon.sourceWidth, frame.height / polygon.sourceHeight)
  const width = polygon.sourceWidth * scale
  const height = polygon.sourceHeight * scale
  return polygon.points.map(point => `${frame.x + (frame.width - width) / 2 + point.x * width},${frame.y + (frame.height - height) / 2 + point.y * height}`).join(" ")
}
