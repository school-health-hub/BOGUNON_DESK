import type { Frame } from "./renderDocument"
import type { SceneLayer } from "./renderScene"

const bounds = { x: 0, y: 0, width: 1200, height: 1200 } as const

function shape(layerId: string, frame: Frame, fill: string, radius: number, stroke?: string): SceneLayer {
  return { kind: "shape", layerId, frame, fill, radius, zOrder: 15, clipBounds: bounds, ...(stroke === undefined ? {} : { stroke, strokeWidth: 1.6 }) }
}

function path(layerId: string, frame: Frame, d: string, fill: string, stroke: string, strokeWidth: number): SceneLayer {
  return { kind: "path", layerId, frame, path: d, fill, stroke, strokeWidth, zOrder: 16, clipBounds: bounds }
}

/** Topic-specific fallback art. These are editable Scene vectors, not generic status icons. */
export function coughEtiquetteIllustration(id: string, frame: Frame): readonly SceneLayer[] {
  const x = frame.x
  const y = frame.y
  const unit = frame.width / 112
  const f = (left: number, top: number, width: number, height: number): Frame => ({ x: x + left * unit, y: y + top * unit, width: width * unit, height: height * unit })
  return [
    shape(`${id}-head`, f(35, 11, 42, 42), "#F5CDAE", 22, "#754932"),
    path(`${id}-hair`, f(31, 5, 50, 35), "M3 18Q5 2 22 2Q24 13 20 22Q14 14 3 18Z", "#3E2A25", "#3E2A25", 1.2),
    path(`${id}-body`, f(20, 45, 72, 62), "M2 8Q4 1 12 1Q20 1 22 8L21 23H3Z", "#54798A", "#315565", 1.1),
    path(`${id}-sleeve`, f(14, 42, 86, 52), "M1 16Q7 3 12 9Q16 15 22 2L23 7Q17 23 11 17Q6 12 2 21Z", "#6C94A5", "#315565", 1.3),
    shape(`${id}-cheek`, f(61, 34, 7, 4), "#E99C91", 3),
  ]
}

export function tissueThenWashIllustration(id: string, frame: Frame): readonly SceneLayer[] {
  const x = frame.x
  const y = frame.y
  const unit = frame.width / 112
  const f = (left: number, top: number, width: number, height: number): Frame => ({ x: x + left * unit, y: y + top * unit, width: width * unit, height: height * unit })
  return [
    shape(`${id}-bin`, f(8, 48, 34, 48), "#8DB6A0", 5, "#4D8065"),
    shape(`${id}-bin-lid`, f(4, 42, 42, 10), "#5D9976", 5, "#3E6F56"),
    path(`${id}-tissue`, f(19, 19, 42, 42), "M2 3Q8 0 13 5Q18 2 23 5L21 21Q14 18 11 23Q6 19 2 21Z", "#FFFFFF", "#A8C7BA", 1.2),
    path(`${id}-arrow`, f(39, 35, 31, 30), "M2 3Q14 3 18 14L14 11 18 22 23 12 19 14Q18 2 2 2Z", "#D18A38", "#B56E22", 0.8),
    shape(`${id}-soap`, f(70, 57, 29, 34), "#A8D9C3", 7, "#4D8065"),
    shape(`${id}-bubble-1`, f(68, 40, 12, 12), "#EAF8F2", 6, "#74A990"),
    shape(`${id}-bubble-2`, f(83, 34, 15, 15), "#FFFFFF", 8, "#74A990"),
    shape(`${id}-bubble-3`, f(96, 48, 9, 9), "#EAF8F2", 5, "#74A990"),
  ]
}

export function autumnBranchLayers(id: string): readonly SceneLayer[] {
  const leaves = [
    { x: 18, y: 28, size: 38, color: "#D85D12", rotate: false },
    { x: 65, y: 39, size: 42, color: "#F09022", rotate: true },
    { x: 108, y: 10, size: 46, color: "#ED7620", rotate: false },
    { x: 146, y: 48, size: 40, color: "#D95D12", rotate: true },
    { x: 91, y: 91, size: 34, color: "#F2A13A", rotate: false },
  ] as const
  return [
    path(`${id}-branch`, { x: 0, y: 0, width: 210, height: 180 }, "M0 22Q9 9 20 3M3 21Q8 15 11 5M7 16Q14 14 20 10M10 12Q15 6 18 2", "none", "#8A4320", 1.25),
    ...leaves.map((leaf, index): SceneLayer => path(`${id}-leaf-${index}`, { x: leaf.x, y: leaf.y, width: leaf.size, height: leaf.size }, leaf.rotate ? "M2 12Q8 1 20 3Q23 15 12 22Q6 18 2 12ZM5 17L18 6" : "M12 1Q23 7 21 18Q11 23 3 16Q3 6 12 1ZM5 17L19 6", leaf.color, "#B95316", 0.8)),
  ]
}

export function heartLayer(id: string, frame: Frame, fill = "#54A06E", zOrder = 18): SceneLayer {
  return { kind: "path", layerId: id, frame, path: "M12 21S3 15 3 8Q3 3 8 3Q11 3 12 6Q13 3 16 3Q21 3 21 8Q21 15 12 21Z", fill, stroke: fill, strokeWidth: 0.5, zOrder, clipBounds: bounds }
}

export function healthShieldLayers(id: string, frame: Frame): readonly SceneLayer[] {
  const cross = { x: frame.x + frame.width * 0.36, y: frame.y + frame.height * 0.32, width: frame.width * 0.28, height: frame.height * 0.38 }
  return [
    path(`${id}-shield`, frame, "M12 2Q16 5 21 6V12Q21 19 12 23Q3 19 3 12V6Q8 5 12 2Z", "none", "#A8CFAD", 1.8),
    shape(`${id}-cross-v`, { x: cross.x + cross.width * 0.36, y: cross.y, width: cross.width * 0.28, height: cross.height }, "#2B9552", 2),
    shape(`${id}-cross-h`, { x: cross.x, y: cross.y + cross.height * 0.36, width: cross.width, height: cross.height * 0.28 }, "#2B9552", 2),
  ]
}
