import { describe, expect, it } from "vitest"
import { importOtterNest, SYNTHETIC_OTTER_NEST_FIXTURE } from "./legacyImport"

describe("otter-nest bounded import", () => {
  it("retains an eighth card losslessly and requires confirmation", async () => {
    // Given
    const input = structuredClone(SYNTHETIC_OTTER_NEST_FIXTURE)
    const before = JSON.stringify(input)

    // When
    const result = await importOtterNest(input, { projectId: "imported-1", now: "2026-01-01T00:00:00.000Z", inputProvenance: "synthetic-fixture" })

    // Then
    expect(result.report.status).toBe("partial")
    expect(result.report.confirmationRequired).toBe(true)
    expect(result.report.inputProvenance).toBe("synthetic-fixture")
    expect(result.report.unmappedEndingCard).toEqual(SYNTHETIC_OTTER_NEST_FIXTURE.cards[7])
    expect(JSON.stringify(input)).toBe(before)
  })

  it("does not claim synthetic fixture provenance for an unlabeled runtime DTO", async () => {
    // Given
    const input = { ...SYNTHETIC_OTTER_NEST_FIXTURE, cards: SYNTHETIC_OTTER_NEST_FIXTURE.cards.slice(0, 7) }

    // When
    const result = await importOtterNest(input, { projectId: "imported-unknown", now: "2026-01-01T00:00:00.000Z" })

    // Then
    expect(result.report.inputProvenance).toBe("unknown")
  })

  it("retains unknown top-level and card fields and requires confirmation", async () => {
    // Given
    const input = {
      ...SYNTHETIC_OTTER_NEST_FIXTURE,
      futureMetadata: { source: "unverified" },
      cards: SYNTHETIC_OTTER_NEST_FIXTURE.cards.slice(0, 7).map((card, index) => index === 1 ? { ...card, unexpectedStyle: { accent: "violet" } } : card),
    }
    const before = structuredClone(input)

    // When
    const result = await importOtterNest(input, { projectId: "imported-unknown-fields", now: "2026-01-01T00:00:00.000Z" })

    // Then
    expect(result.report.status).toBe("partial")
    expect(result.report.confirmationRequired).toBe(true)
    expect(result.report.unmappedUnknownFields).toEqual([
      { path: "$.futureMetadata", value: { source: "unverified" } },
      { path: "cards[1].unexpectedStyle", value: { accent: "violet" } },
    ])
    expect(input).toEqual(before)
  })

  it("imports a seven-card verified DTO shape without confirmation", async () => {
    // Given
    const input = { ...SYNTHETIC_OTTER_NEST_FIXTURE, cards: SYNTHETIC_OTTER_NEST_FIXTURE.cards.slice(0, 7) }

    // When
    const result = await importOtterNest(input, { projectId: "imported-1", now: "2026-01-01T00:00:00.000Z" })

    // Then
    expect(result.report.status).toBe("imported")
    expect(result.report.confirmationRequired).toBe(false)
    expect(result.project.topics).toHaveLength(6)
  })
})
