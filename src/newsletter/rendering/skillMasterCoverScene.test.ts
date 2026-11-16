import { expect, it } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState } from "./designSchema"
import { upgradeNewsletterDesignStateV2, updateCardLayout } from "./designState"
import { applySkillMasterPreset } from "./skillMasterPreset"
import { compileRenderDocument } from "./renderDocument"
import { buildCardScene, validateNewsletterScene } from "./renderScene"

it("uses six live topic titles and separate illustration/mascot layers on the new cover", async () => {
  const now = "2026-11-16T14:40:00.000Z"
  const titles = ["손 위생과 기침 예절", "추워지는 날씨, 안전한 학교생활", "나의 생활 리듬 점검", "시험 기간, 마음 돌보기", "급식 시간, 건강한 식사 습관", "몸과 경계를 존중하기"]
  const project = await createNewsletterProject({ projectId: "ns20-cover", title: "11월 보건소식지", now, topics: titles.map((title, i) => ({ id: `t${i}`, title, text: "학교생활을 살펴봅니다.\n1. 확인하기\n2. 살펴보기\n3. 존중하기\n4. 알리기" })) })
  const initial = applySkillMasterPreset(upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now), { cardIndex: 1, now })
  const design = updateCardLayout(initial, { cardIndex: 0, now, patch: { titleFrame: { x: 190, y: 142, width: 850, height: 108 }, leadFrame: { x: 210, y: 274, width: 780, height: 44 }, closingFrame: { x: 125, y: 767, width: 950, height: 42 }, editorial: { ...initial.cardLayouts[0]?.editorial, layoutType: "A", studentComposition: "mixed", season: "autumn", slogan: "추워지는 계절, 작은 실천으로 몸과 마음을 돌봐요.", closing: "건강한 오늘을 함께 만드는 11월, 보건실이 응원합니다." } } })
  const doc = compileRenderDocument({ project, projectRevision: 1, design, designRevision: design.designRevision })
  const cover = doc.cards[0]
  // This schema-only fixture has no imported images; text/geometry must still fit.
  expect(doc.issues.filter(issue => issue.pageId === "card-cover" && issue.kind !== "missing-text")).toEqual([])
  expect(cover?.topicOverview?.map(topic => topic.text)).toEqual(titles)
  expect(cover?.title.lines).toEqual(["11월 보건소식지"])
  if (cover === undefined) throw new Error("Cover missing")
  const scene = buildCardScene(cover)
  expect(scene.layers.filter(layer => layer.kind === "text" && layer.provenance.kind === "topic-title")).toHaveLength(6)
  expect(new Set(cover.topicOverview?.map(topic => topic.frame.x)).size).toBe(3)
  expect(new Set(cover.topicOverview?.map(topic => topic.frame.y)).size).toBe(2)
  expect(validateNewsletterScene({ projectId: doc.projectId, projectRevision: 1, designRevision: design.designRevision, pages: [scene] })).toEqual([])
  expect(design.cardLayouts.slice(1)).toEqual(initial.cardLayouts.slice(1))
})
