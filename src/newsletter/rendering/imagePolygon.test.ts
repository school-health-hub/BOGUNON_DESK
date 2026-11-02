import { expect, it } from "vitest"
import { imagePolygonPoints } from "./imagePolygon"
import { renderNewsletterSceneSvg } from "../output/svgRenderer"

it("maps source points through the centered cover transform", () => {
  // Given
  const frame = { x: 10, y: 20, width: 100, height: 100 }
  const polygon = { sourceWidth: 200, sourceHeight: 100, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }
  // When / Then
  expect(imagePolygonPoints(frame, "cover", polygon)).toBe("-40,20 160,20 160,120")
})

it("maps source points through the centered contain transform", () => {
  // Given
  const frame = { x: 10, y: 20, width: 100, height: 100 }
  const polygon = { sourceWidth: 200, sourceHeight: 100, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }
  // When / Then
  expect(imagePolygonPoints(frame, "contain", polygon)).toBe("10,45 110,45 110,95")
})

it("keeps feathering and the approved asset reference inside the polygon clip", () => {
  // Given
  const frame = { x: 60, y: 60, width: 1080, height: 1080 }
  const clipPolygon = { sourceWidth: 100, sourceHeight: 100, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }
  // When
  const svg = renderNewsletterSceneSvg({ pageId: "card-cover", width: 1200, height: 1200, templateVersion: 1, layers: [{ kind: "image", layerId: "foreground", slotId: "foreground", assetId: "approved-hero", frame, clipBounds: frame, zOrder: 1, fit: "cover", edgePolicy: "feather", placeholderKind: "generic", clipPolygon }] }, new Map([["approved-hero", "data:image/png;base64,YQ=="]]))
  // Then
  expect(svg).toContain('points="60,60 1140,60 1140,1140"')
  expect(svg).toContain('clip-path="url(#clip-card-cover-foreground-polygon)"')
  expect(svg).toContain('mask="url(#clip-card-cover-foreground-feather)"')
})
