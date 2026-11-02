import { approvedHeroMask } from "./officialAssetProfiles"
import type { CardDesignLayoutV2, TextStyle } from "./designSchema"
import type { Frame } from "./renderDocument"
import type { OfficialElement, OfficialTemplate, OfficialTextBinding } from "./officialTemplateSchema"

const ink = "#122B4E"
const coral = "#DA5872"
const teal = "#368878"
const typeStyle = (fontSize: number, color = ink, align: TextStyle["align"] = "left"): TextStyle => ({ fontFamily: "Pretendard", fontSize, fontWeight: 800, lineHeight: 1.15, color, align })
function copy(id: string, label: string, binding: OfficialTextBinding, frame: Frame, fontSize: number, color = ink, align: TextStyle["align"] = "left"): OfficialElement { return { kind: "text", id, label, binding, frame, style: typeStyle(fontSize, color, align), zOrder: 40 } }
function ornament(id: string, graphic: Extract<OfficialElement, { readonly kind: "ornament" }>["graphic"], frame: Frame, color: string, binding?: OfficialTextBinding, fill?: string): OfficialElement { return { kind: "ornament", id, label: id, graphic, frame, color, zOrder: graphic === "source-prop" ? 15 : graphic === "underline" || graphic === "arrow" ? 26 : 3, ...(binding === undefined ? {} : { binding }), ...(fill === undefined ? {} : { fill }) } }

// Geometry was authored from the November reference anatomy, independently of A/B/C recipes.
export function officialCoverRecipe(card: CardDesignLayoutV2, assets: readonly { readonly id: string; readonly sha256: string }[]): OfficialTemplate {
  const oldMask = approvedHeroMask(card, assets)
  const elements: OfficialElement[] = [
    copy("month", "큰 월 제목", "month", { x: 50, y: 45, width: 300, height: 160 }, 132, coral),
    copy("headline", "보건소식지 제목", "title-rest", { x: 355, y: 65, width: 795, height: 140 }, 108),
    ornament("theme-paint", "brush", { x: 130, y: 218, width: 940, height: 83 }, coral, undefined, "#F5DCE1"),
    copy("theme", "월별 테마", "lead", { x: 155, y: 235, width: 890, height: 65 }, 34, teal, "center"),
    { kind: "image", id: "campus", label: "학생·학교 대표 장면", binding: "main", frame: { x: 0, y: 330, width: 1200, height: 800 }, fit: "contain", edgePolicy: "feather", zOrder: 5 },
    copy("preview-handwash", "첫 건강 주제", "preview-0", { x: 45, y: 352, width: 300, height: 82 }, 30),
    ornament("preview-rule-0", "underline", { x: 60, y: 435, width: 230, height: 18 }, coral),
    ornament("preview-prop-0", "source-prop", { x: 85, y: 425, width: 190, height: 170 }, coral, "preview-0"),
    copy("preview-warmth", "둘째 건강 주제", "preview-1", { x: 430, y: 345, width: 310, height: 82 }, 30),
    ornament("preview-rule-1", "underline", { x: 465, y: 427, width: 245, height: 18 }, teal),
    ornament("preview-prop-1", "source-prop", { x: 490, y: 425, width: 170, height: 180 }, teal, "preview-1"),
    copy("preview-prescription", "셋째 건강 주제", "preview-2", { x: 865, y: 372, width: 285, height: 85 }, 29),
    ornament("preview-rule-2", "underline", { x: 900, y: 455, width: 235, height: 18 }, coral),
    ornament("preview-prop-2", "source-prop", { x: 950, y: 455, width: 155, height: 175 }, coral, "preview-2"),
    { kind: "image", id: "mascot", label: "브랜드 수달쌤", binding: "mascot", frame: { x: 965, y: 930, width: 220, height: 250 }, fit: "contain", edgePolicy: "none", zOrder: 32 },
    ornament("footer-swash", "brush", { x: 55, y: 1106, width: 865, height: 75 }, coral, undefined, "#F8E3E3"),
    copy("closing", "하단 건강 메시지", "closing", { x: 75, y: 1125, width: 825, height: 58 }, 29, teal, "center"),
  ]
  if (oldMask !== undefined && oldMask.assetId === card.image.assetId) {
    elements.unshift({ kind: "image", id: "sky", maskedOnly: true, label: "연속 하늘 배경", binding: "main", frame: { x: 0, y: 0, width: 1200, height: 1200 }, fit: "cover", edgePolicy: "none", zOrder: 1, mask: { ...oldMask, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: .35 }, { x: 0, y: .35 }] } })
    elements.push({ kind: "image", id: "student-foreground", maskedOnly: true, label: "학생 전경 중첩", binding: "main", frame: { x: 0, y: 330, width: 1200, height: 800 }, fit: "contain", edgePolicy: "feather", zOrder: 22, mask: oldMask })
  }
  return { version: 1, kind: "cover", elements }
}
export function officialEducationRecipe(): OfficialTemplate {
  return { version: 1, kind: "education", elements: [
    copy("headline", "큰 주제 제목", "title", { x: 60, y: 45, width: 1080, height: 145 }, 86),
    ornament("subtitle-mark", "brush", { x: 135, y: 202, width: 925, height: 74 }, teal, undefined, "#E2F1EB"),
    copy("subtitle", "한 줄 부제", "lead", { x: 155, y: 220, width: 890, height: 65 }, 32, teal, "center"),
    copy("number-wash", "행동 1 번호", "number-0", { x: 30, y: 285, width: 75, height: 68 }, 54, coral),
    copy("action-wash", "행동 1 원고", "action-0", { x: 115, y: 305, width: 435, height: 115 }, 32),
    { kind: "image", id: "wash", label: "손 씻기 교육 장면", binding: "module-0", frame: { x: 135, y: 420, width: 400, height: 335 }, fit: "contain", edgePolicy: "none", zOrder: 15 },
    ornament("soap-detail", "source-prop", { x: 25, y: 475, width: 105, height: 125 }, coral, "action-0"),
    copy("wash-timing", "원문 시간 강조", "emphasis-0", { x: 40, y: 625, width: 125, height: 70 }, 45, coral),
    ornament("wash-connector", "arrow", { x: 100, y: 670, width: 140, height: 70 }, coral),
    copy("number-cook", "행동 2 번호", "number-1", { x: 600, y: 295, width: 75, height: 68 }, 54, teal),
    copy("action-cook", "행동 2 원고", "action-1", { x: 695, y: 315, width: 450, height: 110 }, 31),
    ornament("cook-ground", "brush", { x: 660, y: 660, width: 495, height: 60 }, teal, undefined, "#E2F1EB"),
    { kind: "image", id: "cook", label: "익혀 먹기 교육 장면", binding: "module-1", frame: { x: 620, y: 425, width: 555, height: 325 }, fit: "contain", edgePolicy: "none", zOrder: 15 },
    copy("number-water", "행동 3 번호", "number-2", { x: 30, y: 765, width: 75, height: 68 }, 54, "#4689A8"),
    copy("action-water", "행동 3 원고", "action-2", { x: 50, y: 850, width: 190, height: 160 }, 32),
    ornament("water-mark", "underline", { x: 55, y: 940, width: 180, height: 16 }, "#4689A8"),
    { kind: "image", id: "water", label: "물 끓이기 교육 장면", binding: "module-2", frame: { x: 250, y: 795, width: 360, height: 300 }, fit: "contain", edgePolicy: "none", zOrder: 15 },
    copy("number-care", "행동 4 번호", "number-3", { x: 610, y: 765, width: 75, height: 68 }, 54, coral),
    ornament("care-speech", "speech", { x: 640, y: 745, width: 530, height: 145 }, coral, undefined, "#FFF5F1"),
    copy("action-care", "행동 4 원고", "action-3", { x: 700, y: 770, width: 410, height: 100 }, 29),
    { kind: "image", id: "care", label: "상담 교육 장면", binding: "module-3", frame: { x: 680, y: 890, width: 455, height: 225 }, fit: "contain", edgePolicy: "none", zOrder: 15 },
    { kind: "image", id: "mascot", label: "하단 수달쌤", binding: "mascot", frame: { x: 1030, y: 1005, width: 160, height: 185 }, fit: "contain", edgePolicy: "none", zOrder: 32 },
    ornament("footer-swash", "brush", { x: 45, y: 1114, width: 935, height: 70 }, coral, undefined, "#F8E3E3"),
    copy("closing", "하단 실천 메시지", "closing", { x: 70, y: 1130, width: 880, height: 55 }, 28, teal, "center"),
  ] }
}
