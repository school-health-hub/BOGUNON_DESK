import { describe, expect, it } from "vitest"
import { structureCanonicalText } from "./contentStructure"

describe("canonical newsletter content structure", () => {
  it("keeps an unmarked sentence as one paragraph", () => {
    const text = "문장형 원고는 의미를 추론하여 목록으로 나누지 않습니다."
    expect(structureCanonicalText(text)).toEqual({ kind: "paragraph", body: text })
  })

  it("uses only explicit line boundaries and preserves every source line", () => {
    const text = "실천 안내\n1. 비누로 30초 이상 손 씻기\n• 기침할 때 옷소매로 가리기\n- 교실 환기하기"
    expect(structureCanonicalText(text)).toEqual({ kind: "list", lead: "실천 안내", actions: ["1. 비누로 30초 이상 손 씻기", "• 기침할 때 옷소매로 가리기", "- 교실 환기하기"] })
  })
})
