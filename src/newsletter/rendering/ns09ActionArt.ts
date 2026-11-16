import type { Frame } from "./renderDocument"
import type { SceneLayer } from "./renderScene"
import { educationArtLayers } from "./skillMasterEducationArt"

/** Small action diagrams only. These are never substitutes for student main artwork. */
export function ns09ActionArtLayers(action: string, id: string, frame: Frame): readonly SceneLayer[] | undefined {
  let order = 14
  const p = (name: string, path: string, fill = "none", stroke = "#655344", width = 0.35): SceneLayer => ({ kind: "path", layerId: `${id}-${name}`, frame, path, fill, stroke, strokeWidth: width, zOrder: order += 0.001, clipBounds: frame })
  const reused = (kind: Parameters<typeof educationArtLayers>[0]) => educationArtLayers(kind, id, frame)
  if (/교직원|상의|도움 요청|끼니/u.test(action)) return reused("talk")
  if (/기분/u.test(action)) return [
    p("drawing-paper", "M3 2H20V22H3Z", "#FFFBEE"),
    p("feeling-face", "M6 10A5 5 0 1 0 16 10A5 5 0 1 0 6 10", "#F5D2B2"),
    p("expression", "M8 9H9M12 9H13M8 12Q11 15 14 12"),
    p("pencil", "M20 9L23 11 17 20 14 21 15 18Z", "#DFB367"),
  ]
  if (/고민.*들어주/u.test(action)) return reused("talk")
  if (/작은 단위|계획|기록/u.test(action)) return reused("planning")
  if (/휴대전화/u.test(action)) return reused("phone-rest")
  if (/계단|복도/u.test(action)) return [
    p("stairs", "M1 22H23M2 20H8V15H14V10H20V5H23", "none", "#709480", 0.7),
    p("shoe-one", "M4 10L7 8 10 9 13 9 14 11 10 12 6 12Z", "#596778"),
    p("shoe-two", "M13 3L16 1 19 2 22 2 23 4 19 5 15 5Z", "#596778"),
  ]
  if (/난방기구/u.test(action)) return [
    p("heater", "M3 8H15V22H3ZM5 11V19M8 11V19M11 11V19M14 11V19", "#E5EDDC"),
    p("heat", "M5 6Q3 4 5 2M9 6Q7 4 9 2M13 6Q11 4 13 2", "none", "#C98B79"),
    p("paper", "M17 9H22V16H17Z", "#FFFBEE"),
    p("keep-clear", "M16 18L23 23M23 18L16 23", "none", "#A64D48", 0.7),
  ]
  if (/식단표/u.test(action)) return [
    p("menu", "M3 2H17V22H3ZM5 6H14M5 10H10M5 14H13M5 18H10", "#FFFBEE"),
    p("allergy-check", "M17 9L23 20H11Z", "#DFB367"),
    p("attention", "M17 13V16M17 18V18.5", "none", "#655344", 0.7),
  ]
  if (/체형|놀리지/u.test(action)) return [
    p("speech", "M2 3H21V15H15L10 21V15H2Z", "#FFFBEE"),
    p("respect-heart", "M11 12Q5 9 7 6Q9 4 11 7Q14 3 16 6Q19 9 11 12Z", "#709480"),
    p("respect-rule", "M4 22H21", "none", "#709480", 0.7),
  ]
  if (/탈의|개인 물품/u.test(action)) return [
    p("curtain", "M2 3H13V22H2ZM5 4V20M9 4V20", "#A9CCD4"),
    p("bag", "M14 11H23V22H14ZM16 11V8Q19 5 21 8V11", "#DFB367"),
    p("privacy-lock", "M17 16H21V20H17ZM18 16V14Q20 12 20 16", "#FFFBEE"),
  ]
  return undefined
}
