import type { Frame } from "./renderDocument"
import type { SceneLayer } from "./renderScene"

export type EducationArt = "sleep" | "phone-rest" | "breathing" | "planning" | "encouragement" | "talk" | "meal" | "eating" | "consent" | "privacy" | "water" | "move" | "warm" | "weather" | "wash" | "stop"
export const EDUCATION_ART_VERSION = "school-education-vector-1"
const color = { ink: "#655344", green: "#709480", light: "#E5EDDC", paper: "#FFFBEE", skin: "#F5D2B2", shade: "#DFB394", hair: "#584334", uniform: "#596778", blue: "#A9CCD4", coral: "#C98B79", gold: "#DFB367" } as const
function brush(id: string, frame: Frame) {
  let order = 14
  return (name: string, path: string, fill: string, stroke: string = color.ink, strokeWidth = 0.24): SceneLayer => ({ kind: "path", layerId: `${id}-${name}`, frame, path, fill, stroke, strokeWidth, zOrder: order += 0.001, clipBounds: frame })
}

/** Free local educational artwork: separate editable paths, never a completed card crop. */
export function educationArtLayers(kind: EducationArt, id: string, frame: Frame): readonly SceneLayer[] {
  const p = brush(id, frame)
  switch (kind) {
    case "phone-rest": return [
      p("phone", "M3 4H13V22H3Z", color.uniform),
      p("screen", "M5 6H11V18H5Z", color.blue),
      p("power", "M7 9V12M5.7 10Q4 15 8 15Q12 15 10.3 10", "none", color.paper, 0.45),
      p("moon", "M19 1Q15 8 23 7Q20 12 16 7Q14 3 19 1Z", color.gold),
      p("pillow", "M14 15Q19 13 23 15V22H14Z", color.light),
    ]
    case "sleep": return [
      p("pillow", "M3 12Q12 10 21 12V21H3Z", color.light),
      p("moon", "M17 2Q13 9 21 8Q18 13 14 8Q11 4 17 2Z", color.gold),
      p("clock", "M3 6A4 4 0 1 0 11 6A4 4 0 1 0 3 6M7 3V6L9 7", color.paper),
      p("blanket", "M5 18Q11 11 20 16L22 22H3Z", color.blue),
      p("face", "M7 13Q10 10 13 12Q16 16 12 18Q8 19 7 15Z", color.skin),
      p("hair", "M7 15Q4 10 9 9Q15 8 15 14L12 12 10 14 8 13Z", color.hair),
      p("eyes", "M9 15Q10 16 11 15M12 14.8Q13 15.7 14 14.6", "none"),
    ]
    case "planning": return [
      p("book", "M3 4Q12 2 21 4V21Q12 19 3 21Z", color.paper),
      p("binding", "M6 3V21M4 7H8M4 12H8M4 17H8", "none", color.green, 0.35),
      p("check", "M9 7L10.5 8.5 13 5.5M9 12L10.5 13.5 13 10.5M9 17L10.5 18.5 13 15.5", "none", color.green, 0.55),
      p("rules", "M15 7H19M15 12H19M15 17H19", "none", "#BBAF94"),
      p("pencil", "M20 2L23 3 18 19 15.5 21 16 17Z", color.gold),
    ]
    case "encouragement": return [
      p("note", "M3 5L20 3 22 20 5 22Z", color.paper),
      p("heart", "M12 16Q4 11 8 8Q11 6 12 9Q15 5 18 8Q21 12 12 16Z", color.coral),
      p("spark", "M4 2V4M1 5H3M21 1V3M21 22L22 24", "none", color.gold, 0.45),
    ]
    case "talk": return [
      p("left-body", "M1 22Q2 15 7 15Q12 15 12 22Z", color.uniform),
      p("right-body", "M13 22Q14 15 19 15Q24 15 24 22Z", color.green),
      p("left-face", "M3 10Q7 6 11 10Q12 16 7 17Q2 16 3 10Z", color.skin),
      p("right-face", "M15 10Q19 6 23 10Q24 16 19 17Q14 16 15 10Z", color.skin),
      p("hair", "M3 11Q0 5 7 5Q13 5 11 11L9 8 7 10 5 8ZM15 11Q13 5 19 5Q25 5 23 11L21 8 18 9Z", color.hair),
      p("eyes", "M5 12H6M8 12H9M17 12H18M20 12H21", "none", color.ink, 0.4),
      p("speech", "M8 1H18Q21 1 21 4V7H16L13 10V7H8Q5 7 5 4Q5 1 8 1Z", color.paper),
      p("listen", "M10 4H11M14 4H15M18 4H19", "none", color.green, 0.5),
    ]
    case "meal": return [
      p("tray", "M2 5Q12 3 22 5L21 21H3Z", "#CFDDD4"),
      p("rice", "M4 15Q8 10 11 15V19H4Z", color.paper),
      p("leaves", "M4 7Q8 4 10 8Q10 12 6 12Q3 11 4 7Z", color.green),
      p("protein", "M13 7Q17 5 20 9L18 12Q14 13 13 10Z", color.gold),
      p("vegetables", "M13 16Q15 13 17 16Q19 13 20 17L19 20H13Z", color.coral),
      p("bowl", "M4 15H11M13 14H20", "none", "#8FA89A"),
    ]
    case "consent": return [
      p("bubble-one", "M2 3H11V11H8L5 14V11H2Z", color.light),
      p("bubble-two", "M13 10H22V19H20L17 22V19H13Z", color.paper),
      p("question", "M5 6Q5 4 8 5Q10 7 7 8V9M7 10V10.2", "none", color.ink, 0.55),
      p("check", "M15 15L17 17 20 13", "none", color.green, 0.65),
    ]
    case "privacy": return [
      p("phone", "M6 1H18Q20 1 20 3V22H4V3Q4 1 6 1Z", color.uniform),
      p("screen", "M6 4H18V19H6Z", color.paper),
      p("lock", "M9 11V8Q12 4 15 8V11M8 11H16V17H8ZM12 13V15", color.gold),
      p("button", "M11 21H13", "none", color.paper, 0.4),
    ]
    case "water": return [
      p("glass", "M5 3H19L17 22H7Z", color.paper),
      p("water", "M6 11Q10 9 13 11Q16 12 18 10L17 22H7Z", color.blue),
      p("shine", "M8 5L9 18M16 7L15.5 10", "none", "#FFFFFF", 0.6),
      p("drop", "M12 1Q7 6 12 7Q17 6 12 1Z", color.blue),
    ]
    case "warm": return [
      p("coat", "M7 3L3 6 1 12 5 14 7 10V22H18V10L20 14 23 12 21 6 17 3 13 6Z", color.green),
      p("lining", "M11 6H14V22H11Z", color.paper),
      p("scarf", "M7 3Q12 7 18 3V7Q13 10 7 7ZM15 7H19V17L15 19Z", color.gold),
      p("stitches", "M16 10H18M16 13H18M16 16H18", "none", color.paper),
    ]
    case "weather": return [
      p("sun", "M2 6A4 4 0 1 0 10 6A4 4 0 1 0 2 6", color.gold),
      p("cloud", "M4 16Q1 10 7 10Q9 5 13 9Q19 8 19 13Q23 13 21 17H4Z", color.blue),
      p("thermometer", "M14 4Q14 1 17 1Q20 1 20 4V16Q25 22 18 23Q11 23 14 17ZM17 6V19", color.paper),
      p("temperature", "M17 11V20", "none", color.coral, 1.3),
    ]
    case "wash": return [
      p("bottle", "M4 8H11V22H3V10Z", color.green),
      p("pump", "M6 8V4H13V6H9V8Z", color.gold),
      p("hand", "M10 17Q9 14 12 15L16 17 20 14Q23 14 21 17L17 21 12 21Z", color.skin),
      p("foam", "M11 11Q9 7 13 7Q14 4 17 7Q22 6 21 10Q24 14 19 15L13 14Z", color.paper),
    ]
    case "stop": return [
      p("hand", "M7 23V14L4 10Q4 8 6 9L8 12V4Q9 2 10 4V10 2Q12 0 13 2V10 3Q15 1 16 3V11 6Q18 4 19 6V18L16 23Z", color.skin),
      p("palm", "M9 14Q13 11 16 14M12 16V20", "none", "#C99E7F"),
    ]
    case "breathing": return studentSceneLayers("breathing", id, frame)
    case "eating": return studentSceneLayers("eating", id, frame)
    case "move": return [
      ...studentSceneLayers("breathing", id, frame),
      p("movement-left", "M2 6Q0 11 2 15M22 6Q24 11 22 15", "none", color.green, 0.55),
    ]
  }
}

export function studentSceneLayers(pose: "breathing" | "eating" | "boundaries", id: string, frame: Frame): readonly SceneLayer[] {
  if (pose === "boundaries") {
    const left = { x: frame.x, y: frame.y + frame.height * 0.16, width: frame.width * 0.51, height: frame.height * 0.8 }
    const right = { x: frame.x + frame.width * 0.49, y: left.y, width: left.width, height: left.height }
    return [...studentSceneLayers("breathing", `${id}-peer-a`, left), ...studentSceneLayers("eating", `${id}-peer-b`, right).filter(layer => !layer.layerId.includes("tray") && !layer.layerId.includes("food") && !layer.layerId.includes("spoon")), ...educationArtLayers("consent", `${id}-dialog`, { x: frame.x + frame.width * 0.27, y: frame.y, width: frame.width * 0.48, height: frame.height * 0.3 })]
  }
  const p = brush(id, frame)
  const person = [
    p("ground", "M1 23Q12 21 23 23Z", color.light, "none"),
    p("uniform", "M7 12Q12 10 17 12L21 23H3Z", color.uniform),
    p("lapel", "M8 12L12 18 16 12 14 11H10Z", color.paper),
    p("tie", "M11 14H13L14 21 12 23 10 21Z", color.green),
    p("neck", "M10 9H14V13L12 15 10 13Z", color.shade),
    p("face", "M6.5 5Q12 1 17.5 5L17 9Q16 12 12 12Q8 12 7 9Z", color.skin),
    p("hair", "M6.5 7Q4 1 11 1Q19 0 18 7L16 4 14 6 12 4 10 6 8 5Z", color.hair),
    p("hair-shine", "M8 3Q12 1.8 15 3M9 3.7L12 3", "none", "#9A7C5A", 0.22),
    p("eyes", pose === "breathing" ? "M8.5 8Q10 9 11 8M13 8Q14.5 9 16 8" : "M9 8H10M14 8H15", "none", color.ink, 0.35),
    p("smile", "M11 10Q12 10.8 13 10", "none"),
    p("cheeks", "M8.5 9.4H10M14 9.4H15.5", "none", "#DCA18A", 0.45),
    p("arms", "M6 14Q4 15 5 18L10 21 12 19 8 16M18 14Q20 15 19 18L14 21 12 19 16 16", color.uniform),
    p("hands", "M10 18Q12 17 14 18L15 20 12 21 9 20Z", color.skin),
  ]
  if (pose === "breathing") return [...person, p("breath", "M18 8Q23 7 21 5M18 10Q24 10 22 12", "none", color.green, 0.25)]
  return [...person,
    p("tray", "M2 19H22L21 23H3Z", "#C8D8D0"),
    p("food-rice", "M4 21Q7 17 10 21Z", color.paper),
    p("food-vegetable", "M12 21Q12 18 15 19Q18 18 18 21Z", color.green),
    p("food-protein", "M16 22L19 20 21 22Z", color.gold),
    p("spoon", "M16 9L20 17M15 8Q14 6 16 6Q18 7 16 9Z", color.paper),
  ]
}

export function educationArtForAction(action: string): EducationArt | undefined {
  const rules: readonly (readonly [RegExp, EducationArt])[] = [
    [/동의/u, "consent"], [/사진|정보.*공유/u, "privacy"], [/접촉|싫다|거절/u, "stop"],
    [/비누|손 씻/u, "wash"], [/날씨|체감온도/u, "weather"], [/겹쳐|장갑|목도리/u, "warm"],
    [/몸.*움직|실내.*활동/u, "move"], [/휴대전화/u, "phone-rest"], [/카페인|잠들|일어나는|수면/u, "sleep"],
    [/호흡|잠시.*쉬/u, "breathing"], [/계획|작은 단위/u, "planning"], [/노력|비교/u, "encouragement"],
    [/골고루/u, "meal"], [/천천히.*씹|먹을 만큼/u, "eating"], [/물.*선택/u, "water"],
    [/도움|보호자|보건교사/u, "talk"],
  ]
  return rules.find(([pattern]) => pattern.test(action))?.[1]
}

export function educationArtForTopic(title: string): "breathing" | "eating" | "boundaries" | undefined {
  if (title.includes("마음")) return "breathing"
  if (title.includes("식사")) return "eating"
  if (title.includes("경계")) return "boundaries"
  return undefined
}
