import type { Frame } from "./renderDocument"
import type { SceneLayer } from "./renderScene"

type IllustrationKind = "handwash" | "steam" | "water" | "clinic" | "sleep" | "ear" | "warmth" | "scarf" | "capsule" | "coffee" | "neutral"
function kindForText(text: string): IllustrationKind {
  if (/손\s*씻|비누|감염|장염/u.test(text)) return "handwash"
  if (/카페인|커피/u.test(text)) return "coffee"
  if (/항생제|의약|복약|약물/u.test(text)) return "capsule"
  if (/감기|추위|겨울|목도리/u.test(text)) return "scarf"
  if (/음식|익혀|익히|조리|증기|가습|냄비/u.test(text)) return "steam"
  if (/물|음료|카페인/u.test(text)) return "water"
  if (/수면|잠|쉬/u.test(text)) return "sleep"
  if (/귀|이어폰/u.test(text)) return "ear"
  if (/온열|핫팩|저온/u.test(text)) return "warmth"
  if (/보건실|진료|상담|방문|알리/u.test(text)) return "clinic"
  return "neutral"
}

export function illustratedActionScene(id: string, text: string, frame: Frame, clipBounds: Frame): readonly SceneLayer[] {
  const layers: SceneLayer[] = []
  const path = (name: string, d: string, fill: string, stroke = "none", strokeWidth = 0.5): void => {
    layers.push({ kind: "path", layerId: `${id}-${name}`, frame, path: d, fill, stroke, strokeWidth, zOrder: name === "organic-field" ? 6 : 14 + layers.length, clipBounds })
  }
  path("organic-field", "M2 9Q1 2 9 2Q14 0 20 4Q25 10 21 18Q17 24 8 22Q0 21 2 9Z", "#EAF2DD")
  switch (kindForText(text)) {
    case "handwash":
      path("soap", "M3 10V6Q3 5 4 5H8Q9 5 9 6V16H3Z", "#ECC381", "#9D753F")
      path("pump", "M5 5V3H10V4H7V5", "#6B896C")
      path("left-hand", "M5 18L10 13Q11 12 12 13L15 16L12 20Q8 23 5 18Z", "#F3BF99", "#BE8869")
      path("right-hand", "M12 15L17 11Q18 10 19 12L21 17Q20 21 16 21L12 19Z", "#F7D1AD", "#BE8869")
      path("foam", "M9 14Q8 11 11 11Q12 8 15 10Q19 9 19 13Q22 15 19 17Q16 20 13 17Q9 18 9 14Z", "#FFFFFF", "#A9CCD5")
      path("bubbles", "M12 6a1 1 0 1 0 .01 0M18 5a1.4 1.4 0 1 0 .01 0M21 9a.8.8 0 1 0 .01 0", "#D9F1F6", "#A9CCD5")
      break
    case "steam":
      path("table", "M2 19H23V21H2Z", "#C59B68")
      path("pot", "M5 11H20L19 18Q13 22 6 18Z", "#D89559", "#8F6443")
      path("water", "M5 11Q12 7 20 11Q13 15 5 11Z", "#A8DCE2", "#638E99")
      path("handles", "M5 12H2V15H6M20 12H23V15H19", "none", "#8F6443", 1.1)
      path("steam", "M8 8Q5 6 8 4Q10 2 8 1M13 8Q10 6 13 4Q15 2 13 1M18 8Q15 6 18 4Q20 2 18 1", "none", "#A7BAB1", 1)
      break
    case "water":
      path("jug", "M6 7H15V19Q10 22 5 19Z", "#BDDDE5", "#518397")
      path("lid", "M5 5H16V8H5Z", "#608D98")
      path("handle", "M15 9Q23 8 21 15Q20 17 15 16", "none", "#608D98", 1.5)
      path("water-fill", "M7 12Q10 10 14 12V18Q10 20 7 18Z", "#6CB5D2")
      path("cup", "M17 17H23L22 23H18Z", "#F9F8EB", "#B5B79B")
      path("drop", "M10 1Q5 6 10 7Q15 6 10 1Z", "#68B3D0")
      if (/끓|익/u.test(text)) path("boiled-steam", "M7 4Q5 2 7 0M15 4Q13 2 15 0", "none", "#A7BAB1", .8)
      break
    case "clinic":
      path("door", "M4 2H20V23H4Z", "#D7B98B", "#A48666")
      path("door-panel", "M6 4H18V22H6Z", "#F9EAD1")
      path("cross", "M10 7H14V10H17V14H14V17H10V14H7V10H10Z", "#5E9B70")
      path("handle", "M16 18a.8.8 0 1 0 .01 0", "#9F815E")
      path("case", "M1 17H10V23H1ZM4 17V15H7V17", "#FFFFFF", "#779381")
      path("case-cross", "M5 18H6V19H7V20H6V21H5V20H4V19H5Z", "#D8756A")
      break
    case "sleep":
      path("moon", "M17 2Q3 0 3 12Q3 24 17 22Q8 19 8 12Q8 5 17 2Z", "#EBC471", "#C29B51")
      path("stars", "M18 5L19 8L22 9L19 10L18 13L17 10L14 9L17 8ZM20 16L21 18L23 19L21 20L20 22L19 20L17 19L19 18Z", "#89ACCA")
      break
    case "ear":
      path("ear", "M7 18Q2 15 5 7Q8 0 16 3Q22 6 18 14Q14 17 13 21Q10 24 7 18Z", "#F0BD94", "#BE8C68")
      path("inner-ear", "M8 15Q6 7 12 6Q18 6 15 12L11 14L10 18", "none", "#C98D65", 1)
      path("sound", "M20 8Q24 12 20 16M2 9Q0 12 2 15", "none", "#719FAF", 1)
      break
    case "warmth":
      path("blanket", "M2 10Q12 5 22 10L20 22H4Z", "#DBB28D", "#AC805E")
      path("pocket", "M7 11H17V19H7Z", "#F3DEBE", "#AC805E")
      path("heat", "M8 7Q5 5 8 2M13 7Q10 5 13 2M18 7Q15 5 18 2", "none", "#CB8B69", 1)
      break
    case "scarf":
      path("scarf", "M5 4Q12 1 19 5L17 10L14 9L16 21H10L9 10L5 12L2 8Z", "#D98B74", "#B86D58")
      path("weave", "M6 5L17 8M10 13L15 12M11 17L16 16M11 20L16 19", "none", "#F2C7A9", .8)
      break
    case "capsule":
      path("pill", "M6 6Q10 2 14 6L20 12Q24 17 19 20Q16 23 12 19L6 13Q2 10 6 6Z", "#FBF9E9", "#879894")
      path("pill-half", "M6 6Q10 2 14 6L16 8L8 16L6 13Q2 10 6 6Z", "#85B5A1", "#879894")
      path("shine", "M7 8L10 5", "none", "#DFF2E7", 1)
      break
    case "coffee":
      path("saucer", "M3 20Q12 17 22 20Q13 25 3 20Z", "#D4B48E")
      path("cup", "M5 8H18V17Q12 23 5 17Z", "#F7EBDA", "#A78D72")
      path("drink", "M5 8Q11 5 18 8Q11 12 5 8Z", "#8B6548")
      path("handle", "M18 10Q24 9 23 14Q22 18 18 16", "none", "#A78D72", 1.3)
      path("steam", "M8 4Q6 2 8 0M13 4Q11 2 13 0", "none", "#A7BAB1", .8)
      break
    case "neutral":
      path("book", "M3 6Q8 3 12 6Q17 3 22 6V21Q17 18 12 21Q8 18 3 21Z", "#FCFAEE", "#8AA393")
      path("spine", "M12 6V21M5 9H9M15 9H19M5 12H9M15 12H19", "none", "#A7B59E", .7)
      break
  }
  return layers
}
