import type { PathSceneLayer } from "./renderScene"
import type { Frame } from "./renderDocument"

// Small geometric props describe the source action; they do not add educational copy.
const PATHS = {
  checklist: "M3 5l2 2 3-4 M11 5h10 M3 12l2 2 3-4 M11 12h10 M3 19l2 2 3-4 M11 19h10",
  soap: "M7 8h10v13H7Z M10 8V4h8 M12 4V2 M18 4v2 M3 9a1 1 0 1 0 0 .1 M20 11a1 1 0 1 0 0 .1 M10 13h4v4h-4Z",
  bottle: "M9 2h6v4l3 4v11H6V10l3-4Z M9 6h6 M7 14h10 M9 17h6",
  capsule: "M4 20a5 5 0 0 1 0-7l9-9a5 5 0 0 1 7 7l-9 9a5 5 0 0 1-7 0Z M8.5 8.5l7 7",
  scarf: "M4 3h16v6H4Z M7 9v11h5V9 M15 9v8h5V9 M8 20v2 M11 20v2 M16 17v2 M19 17v2",
  clock: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 7v5l4 2 M4 2L1 5 M20 2l3 3",
  pillow: "M3 6q9-3 18 0v13q-9 3-18 0Z M6 9h12v7H6Z M16 1h5l-5 3h5",
  stop: "M7 12V5a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-6a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v8q0 7-7 7-4 0-6-4l-3-5q-1-3 2-3l3 4",
  heatpack: "M5 9h14v12H5Z M8 10v10 M16 10v10 M8 7q-3-2 0-5 M12 7q-3-2 0-5 M16 7q-3-2 0-5",
  clinic: "M4 7h16v14H4Z M9 7V3h6v4 M10 11h4v3h3v3h-3v3h-4v-3H7v-3h3Z",
  pot: "M4 10h16v9q0 3-3 3H7q-3 0-3-3Z M2 11v5 M22 11v5 M3 7h18 M12 4v3 M7 4q-2-2 0-3 M17 4q-2-2 0-3",
  shield: "M12 2 21 6v7q0 6-9 10-9-4-9-10V6Z M12 7v7 M12 18h.01",
  exit: "M10 3H3v18h7 M9 12h13 M17 7l5 5-5 5",
  document: "M5 2h10l4 4v16H5Z M15 2v5h4 M8 11h8 M8 15h8 M8 19h5",
  coat: "M8 2 3 6 1 15l4 2 2-7v12h10V10l2 7 4-2-2-9-5-4-4 4Z M12 6v16",
  thermometer: "M9 15V5a3 3 0 0 1 6 0v10a5 5 0 1 1-6 0Z M12 8v11 M17 5h4 M17 9h3",
  coffee: "M3 8h14v10q0 4-4 4H7q-4 0-4-4Z M17 9h3q4 4 0 7h-3 M6 5q-3-2 0-4 M12 5q-3-2 0-4",
  walking: "M13 2a2 2 0 1 0 0 4a2 2 0 1 0 0-4 M11 8l4 3 5 1 M11 8l-4 5-4 1 M11 8l-1 8 5 6 M10 16l-5 6",
} as const
function pathFor(text: string): string {
  if (/장갑|목도리|손과 목/u.test(text)) return PATHS.scarf
  if (/손|비누|장염/u.test(text)) return PATHS.soap
  if (/음식|익혀|식사/u.test(text)) return PATHS.pot
  if (/유해|위험/u.test(text)) return PATHS.shield
  if (/벗어나|이동|실내/u.test(text)) return PATHS.exit
  if (/주의|사용법|처방을|함량|문구/u.test(text)) return PATHS.document
  if (/여러 겹/u.test(text)) return PATHS.coat
  if (/날씨|체감온도/u.test(text)) return PATHS.thermometer
  if (/잘 때|잠|수면/u.test(text)) return PATHS.pillow
  if (/오래|기간|저녁/u.test(text)) return PATHS.clock
  if (/몸 움직|가볍게/u.test(text)) return PATHS.walking
  if (/커피|에너지|카페인/u.test(text)) return PATHS.coffee
  if (/핫팩|맨살|한 부위|저온화상/u.test(text)) return PATHS.heatpack
  if (/손|비누|화장실/u.test(text)) return PATHS.soap
  if (/보건실|상담|도움|보호자/u.test(text)) return PATHS.clinic
  if (/항생|약|복용|처방/u.test(text)) return PATHS.capsule
  if (/추위|옷|장갑|목도리|보온|날씨|체감온도/u.test(text)) return PATHS.scarf
  if (/수면|잠|휴식|쉬/u.test(text)) return PATHS.pillow
  if (/저녁|시간|확인/u.test(text)) return PATHS.clock
  if (/담배|거절|연기|유해/u.test(text)) return PATHS.stop
  if (/물(?:을|은|\s|$)|수분|음료|카페/u.test(text)) return PATHS.bottle
  return PATHS.checklist
}
export function editorialActionIcon(id: string, text: string, frame: Frame, color: string): PathSceneLayer {
  return { kind: "path", layerId: id, frame, path: pathFor(text), stroke: color, strokeWidth: 1.3, fill: "none", zOrder: 6, clipBounds: frame }
}
