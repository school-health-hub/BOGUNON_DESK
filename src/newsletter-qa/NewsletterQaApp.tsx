import { useEffect, useState } from "react"
import { createNewsletterProject } from "../newsletter/project"
import type { NewsletterProject } from "../newsletter/schema"
import { createNewsletterDesignState, type NewsletterDesignState } from "../newsletter/rendering/designSchema"
import { NewsletterDesignEditor } from "../newsletter/rendering/NewsletterDesignEditor"
import "../newsletter/rendering/fonts/pretendard.css"
import "./newsletter-qa.css"

type QaFixture = { readonly project: NewsletterProject; readonly design: NewsletterDesignState }

class NewsletterFontLoadError extends Error {
  readonly name = "NewsletterFontLoadError"
  constructor() {
    super("Pretendard Korean font did not load")
  }
}

async function createFixture(): Promise<QaFixture> {
  if (document.fonts !== undefined) {
    const loadedFonts = await document.fonts.load("400 16px Pretendard", "한글 보건소식")
    if (loadedFonts.length === 0) throw new NewsletterFontLoadError()
  }
  const project = await createNewsletterProject({
    projectId: "newsletter-qa",
    title: "10월 학교 보건소식",
    now: "2026-10-01T00:00:00.000Z",
    topics: [
      { id: "seasonal-health", title: "환절기 건강관리", text: "아침저녁 기온 차가 큽니다. 얇은 옷을 여러 겹 입고 충분한 물을 마셔요." },
      { id: "hand-hygiene", title: "올바른 손 씻기", text: "흐르는 물과 비누로 30초 이상 손바닥, 손등, 손가락 사이를 꼼꼼히 씻어요." },
      { id: "eye-health", title: "눈 건강과 화면 사용", text: "화면을 20분 보았다면 20초 동안 먼 곳을 바라보고 눈을 쉬게 해요." },
      { id: "nutrition", title: "균형 잡힌 식사", text: "아침을 거르지 않고 곡류, 채소, 단백질 식품을 골고루 먹어요." },
      { id: "mind-care", title: "마음 건강 돌보기", text: "걱정이 오래 이어지면 혼자 참지 말고 믿을 수 있는 어른이나 보건실에 이야기해요." },
      { id: "emergency", title: "응급상황 대처", text: "위험한 상황에서는 주변 어른에게 즉시 알리고 안전한 장소에서 도움을 기다려요." },
    ],
  })
  return { project, design: createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: project.projectRevision, now: "2026-10-01T00:00:00.000Z", schoolName: "합성고등학교", issueLabel: "2026년 10월" }) }
}

export function NewsletterQaApp() {
  const [fixture, setFixture] = useState<QaFixture>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    void createFixture().then((value) => { if (active) setFixture(value) }).catch((error: unknown) => { if (active) setFailed(true); if (!(error instanceof Error)) throw error })
    return () => { active = false }
  }, [])
  if (failed) return <main role="alert">합성 Newsletter QA 데이터를 준비하지 못했습니다.</main>
  if (fixture === undefined) return <main role="status">Newsletter QA 화면을 준비하는 중입니다.</main>
  return <NewsletterDesignEditor project={fixture.project} initialDesign={fixture.design} />
}
