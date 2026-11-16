import { describe, expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState } from "./designSchema"
import { upgradeNewsletterDesignStateV2 } from "./designState"
import { applySkillMasterPreset } from "./skillMasterPreset"
import { applySeptemberA4Preset } from "./skillMasterA4"
import { compileRenderDocument } from "./renderDocument"
import { buildA4PageScene, buildCardScene, validateNewsletterScene } from "./renderScene"

const now = "2026-11-16T14:00:00.000Z"
const actions = ["등교 전 날씨를 확인하고 겹쳐 입을 옷 준비하기", "계단과 복도에서는 뛰지 않고 천천히 이동하기", "난방기구 주변에 종이·옷 등 물건을 두지 않기", "바닥이 미끄럽거나 시설이 파손됐으면 교직원에게 알리기"]
async function fixture() {
  const project = await createNewsletterProject({ projectId: "ns18-a4", title: "11월 보건소식지", now, topics: Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, title: i === 0 ? "추워지는 날씨, 안전한 학교생활" : `건강 주제 ${i + 1}`, text: ["추운 날의 옷차림과 등하굣길·교내 안전을 점검합니다.", ...actions.map((action, j) => `${j + 1}. ${action}`)].join("\n") })) })
  const design = applySkillMasterPreset(upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now), { cardIndex: 1, now })
  return { project, design }
}
describe("September A4 review composition", () => {
  it("keeps canonical and card state while arranging six A4 modules", async () => {
    const { project, design } = await fixture()
    const next = applySeptemberA4Preset(design, now)
    expect(next.cardLayouts).toEqual(design.cardLayouts)
    expect(next.assetManifest).toEqual(design.assetManifest)
    expect(next.canonicalProjectRevision).toBe(design.canonicalProjectRevision)
    const doc = compileRenderDocument({ project, projectRevision: 1, design: next, designRevision: next.designRevision })
    const scene = buildA4PageScene(doc.a4)
    expect(doc.cards).toHaveLength(7)
    expect(doc.a4.modules).toHaveLength(6)
    expect(scene.width).toBe(1240)
    expect(scene.height).toBe(1754)
    const rules = scene.layers.filter(layer => layer.kind === "text" && /-action-\d$/u.test(layer.layerId))
    expect(rules).toHaveLength(24)
    expect(rules.map(rule => rule.kind === "text" ? rule.text : "")).toEqual(Array.from({ length: 6 }, () => actions).flat())
    expect(validateNewsletterScene({ projectId: doc.projectId, projectRevision: 1, designRevision: next.designRevision, pages: [scene] })).toEqual([])
    expect(new Set(doc.a4.modules.map(module => module.moduleFrame.x)).size).toBe(2)
    expect(new Set(doc.a4.modules.map(module => module.moduleFrame.y)).size).toBe(3)
    expect(scene.layers.filter(layer => layer.kind === "image" && layer.layerId.endsWith("-main-art"))).toHaveLength(6)
  })
  it("separates a two-line card title from its lead without shrinking title type", async () => {
    const { project, design } = await fixture()
    const doc = compileRenderDocument({ project, projectRevision: 1, design, designRevision: design.designRevision })
    const card = doc.cards[1]
    expect(card?.title.lines).toHaveLength(2)
    expect(card?.title.style.fontSize).toBe(68)
    expect(card?.lead?.frame.y).toBe(310)
    if (card !== undefined) expect(validateNewsletterScene({ projectId: doc.projectId, projectRevision: 1, designRevision: design.designRevision, pages: [buildCardScene(card)] })).toEqual([])
  })
})
