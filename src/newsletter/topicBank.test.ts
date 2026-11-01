import { describe, expect, it } from "vitest"
import { createTopicBank, queryTopicBank } from "./topicBank"

const topic = (id: string, title: string, schoolType: "girls-high" | "boys-high" | "coed-high" = "coed-high") => ({
  id,
  title,
  year: 2026,
  month: 3,
  schoolType,
  source: { kind: "local-fixture" as const, label: "Synthetic fixture", reference: "docs/newsletter/topic-bank.md" },
  reviewStatus: "pending" as const,
})

describe("local topic bank", () => {
  it("filters by year month and school type in deterministic id order", () => {
    // Given
    const bank = createTopicBank([topic("topic-b", "Sleep"), topic("topic-a", "Nutrition"), topic("topic-c", "Exercise", "girls-high")])

    // When
    const result = queryTopicBank(bank, { year: 2026, month: 3, schoolType: "coed-high" })

    // Then
    expect(result.map((item) => item.id)).toEqual(["topic-a", "topic-b"])
  })

  it.each([
    ["duplicate ids", [topic("topic-a", "Sleep"), topic("topic-a", "Nutrition")]],
    ["normalized duplicate titles", [topic("topic-a", "Healthy  Sleep"), topic("topic-b", " healthy sleep ")]],
  ])("rejects %s", (_name, candidates) => {
    // Given
    // When
    const result = () => createTopicBank(candidates)

    // Then
    expect(result).toThrow()
  })
})
