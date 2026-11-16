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
  let paintOrder = 15
  const p = (part: string, d: string, fill: string, stroke = "#5E5148", width = 0.32): SceneLayer => ({ ...path(`${id}-${part}`, frame, d, fill, stroke, width), zOrder: paintOrder += 0.01 })
  return [
    p("ground", "M3 22Q12 20.8 21 22Q12 23.7 3 22Z", "#DCE5D7", "none"),
    p("body", "M6.3 14Q11.7 12.1 17 14L19.7 22H4.3Z", "#64888D"),
    p("body-shadow", "M14 15L17 14 19.7 22H14.5Z", "#43686F", "none"),
    p("neck", "M10 11.2H14.6V15Q12 17 10 14.5Z", "#EDBF99"),
    p("collar", "M8.8 14L11.8 16.1 14.8 13.8 15.6 15.5 12.1 18.1 8 15.8Z", "#F7F3E8"),
    p("hair-back", "M5.9 8.1Q4.1 2.5 10 1.4Q17.2-.3 18.4 6.2L17.7 12.8 6.3 12.2Z", "#4C3C32"),
    p("face", "M6.5 6.9Q11 3 17.3 6.6L17.1 10.7Q16.7 15.2 12.1 15.7Q7.7 14.9 6.9 11.4Z", "#F7D6B5"),
    p("face-shade", "M15.9 7.8L17.3 6.6 17.1 10.7Q16.7 14.8 12.1 15.7L12.2 14.6Q16.4 13.9 15.9 7.8Z", "#EBC1A0", "none"),
    p("ear", "M6.7 9Q4.5 7.9 5.6 11.3L7.1 12.3", "#F1C6A5"),
    p("fringe", "M6.3 8.1Q4.8 3.6 8.4 2.4Q15.8-.2 18 5.4L18.1 9.3 16 6.4 15.2 8 13.3 5.6 11.4 7.4 10.8 5.8 7.5 8.2Z", "#574234"),
    p("hair-light", "M7 4.6Q11 1.4 15.3 3.3M7.8 5.4Q10 3.8 11.8 3.8", "none", "#8A6B4E", 0.38),
    p("brows", "M8.4 8.7L10.5 9.1M13.6 9.1L15.6 8.5", "none", "#534135", 0.42),
    p("eyes", "M8.6 10.4Q9.4 9.7 10.2 10.5M13.6 10.5Q14.5 9.7 15.2 10.2", "none", "#3E372F", 0.5),
    p("blush", "M7.8 11.3L9.8 11.6M14.6 11.5L16 11.2", "none", "#DF9C88", 0.72),
    p("sleeve", "M4.1 19.7Q4.1 16.8 7.1 15.2L14.5 11.5Q16.9 10.4 18.4 12.9Q19.8 15.2 16.6 16.8L8.8 21Q5.9 22.4 4.1 19.7Z", "#71979A"),
    p("fold", "M5.4 19.5Q8.1 18 10.5 17M11.6 14.7L14 16.8M15.1 12.2Q16.4 12.4 16.8 14.9", "none", "#426C75", 0.4),
    p("elbow-light", "M6 17.1Q8 15.7 10.7 14.4", "none", "#B4CBBD", 0.55),
    p("hand", "M16.4 11.4Q18.8 9.3 20.1 11L21 13.4Q20.3 15 18.7 14.6L17.8 13.1Z", "#F4CFAD"),
    p("gesture", "M20 7.3L21 6.6M20.9 9L22.3 8.8", "none", "#86AFA0", 0.4),
  ]
}

export function tissueThenWashIllustration(id: string, frame: Frame): readonly SceneLayer[] {
  let paintOrder = 15
  const p = (part: string, d: string, fill: string, stroke = "#5E6756", width = 0.32): SceneLayer => ({ ...path(`${id}-${part}`, frame, d, fill, stroke, width), zOrder: paintOrder += 0.01 })
  return [
    p("ground", "M2 22Q12 20.5 23 22Q12 23.8 2 22Z", "#DCE5D7", "none"),
    p("bin", "M3.8 11.5L4.5 21Q8 22.6 11.3 21L12.1 11.5Z", "#9ABD9B"),
    p("bin-side", "M9.3 12L12.1 11.5 11.3 21Q10.2 21.5 9 21.5Z", "#719776", "none"),
    p("bin-rim", "M3 11Q7.9 9.2 12.8 11L12.5 12Q8 13.4 3.3 12Z", "#477561"),
    p("bin-highlight", "M5.1 14L5.5 19.5M6.6 14.2L6.9 20", "none", "#D0DFBD", 0.44),
    p("cuff", "M16.7 1.2L22 4.2 19.4 8.8 15.2 5.8Z", "#718C94", "#4C6068"),
    p("hand", "M15.4 4.2L19.5 6.5Q18.8 8.4 17.3 8.5L13.7 7.2 12 9.8Q10.5 10.6 10.7 9.1L12.4 5.7Q13.4 4.1 15.4 4.2Z", "#F5D1AD", "#88694F"),
    p("fingers", "M13.6 6.1L16.1 7.1M13 7.1L15 8", "none", "#BF9573", 0.23),
    p("tissue", "M6.5 5.7L8.4 4.9 9.6 6 11.3 5.9 12 8.4 10.7 10 8.6 9.3 7.4 10.2 5.6 8.5Z", "#FFFDF3", "#9BADA1"),
    p("tissue-fold", "M6.5 6.3L9 7.6 10.8 6.5M9 7.6L8.6 9.3", "none", "#C3CEC2", 0.24),
    p("motion", "M6 3.6L5.3 2.2M9 3L9.1 1.7", "none", "#BD965D", 0.3),
    p("soap", "M16.5 14Q14.4 14 14.4 16.2V21Q17.3 22.2 20.2 21V16.2Q20.2 14 18.2 14Z", "#BAD6BD"),
    p("soap-shade", "M18.6 14.4Q20.1 15 20.2 16.2V21L18.4 21.4Z", "#8CB9A6", "none"),
    p("pump", "M16.7 14V11.9H20.9V12.9H18.2V14Z", "#F4E2B3"),
    p("label", "M15.6 16H19V19.7H15.6Z", "#F5F6E6", "#96B59B", 0.2),
    p("drop", "M17.3 16.7Q19 18.7 17.3 19Q15.8 18.6 17.3 16.7Z", "#7DAE9F", "none"),
    p("bubbles", "M18.3 8.3A1.1 1.1 0 1 0 20.5 8.3A1.1 1.1 0 1 0 18.3 8.3M21 10.5A.8 .8 0 1 0 22.6 10.5A.8 .8 0 1 0 21 10.5", "#FBFEF7", "#94B6A1", 0.25),
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
    path(`${id}-branch`, { x: 8, y: 8, width: 205, height: 190 }, "M0 23C5 17 10 8 20 3M4 17Q2 12 3 7M7 14Q12 14 18 11M11 9Q10 6 14 1M15 6Q18 4.8 22 5", "none", "#86512C", 0.32),
    ...leaves.flatMap((leaf, index): readonly SceneLayer[] => {
      const frame = { x: leaf.x, y: leaf.y, width: leaf.size * 1.18, height: leaf.size * 1.25 }
      return [
        path(`${id}-leaf-${index}`, frame, leaf.rotate ? "M11 22Q10 19 8.6 17.7L2.3 19Q4 16 4.5 14.3L.7 10.9 6 9.5 4.4 3.6Q7.5 5.4 9 6L12.5 .8 14.3 7Q17 5.8 20.8 5L18.6 10.5 23 13 18 15.2 19.8 20 14 18.5Z" : "M11.5 22Q10.6 19 9.5 18L3 19Q4.7 16.8 5 15L.8 12Q3.3 11.5 5.8 10L3.9 5Q7 5.9 9 7L11.8 .8Q12.2 4.1 14 7L19.8 4Q19.5 7.6 18 10L23 11.8Q20.9 14 18.7 15L21 19Q17.4 19.2 14 18Z", leaf.color, "#B9782D", 0.22),
        path(`${id}-vein-${index}`, frame, "M11.5 23Q13 13 11.8 3M12 13L6 8M12 16L4 14M12.5 11L18.7 7M12.5 16L19 14", "none", "#A45C26", 0.19),
      ]
    }),
    path(`${id}-lower-stem`, { x: 20, y: 997, width: 95, height: 140 }, "M9 24Q9 12 13 1M9 20L3 15M10 15L18 10M11 9L6 4", "none", "#648651", 0.45),
    ...[{ x: 22, y: 1050 }, { x: 52, y: 1030 }, { x: 30, y: 999 }, { x: 58, y: 1080 }].map((leaf, index): SceneLayer => path(`${id}-lower-leaf-${index}`, { ...leaf, width: 35, height: 48 }, "M3 23Q0 6 20 1Q23 16 3 23ZM3 23L17 5", index % 2 === 0 ? "#91AF66" : "#B4C78B", "#6F914F", 0.25)),
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
