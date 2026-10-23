import { describe, expect, it } from "vitest"
import { applyUserEdit, effectiveSectionText, regenerateSection, restoreRevision } from "./editing"
import { importOtterNest, SYNTHETIC_OTTER_NEST_FIXTURE } from "./legacyImport"
import { createNewsletterProject } from "./project"

describe("NS-2 data engine narrative", () => {
  it("creates edits regenerates restores and imports without losing user work", async () => {
    // Given
    const created = await createNewsletterProject({ projectId: "narrative-1", title: "Synthetic newsletter", now: "2026-01-01T00:00:00.000Z" })
    const topicId = created.topics[0]?.id
    if (topicId === undefined) throw new Error("test fixture has no topic")
    const baselineOtherHashes = created.canonicalCopy.sections.slice(1).map((section) => section.semanticHash)

    // When
    const edited = await applyUserEdit(created, { topicId, text: "Teacher-approved wording", now: "2026-01-02T00:00:00.000Z" })
    const regenerated = await regenerateSection(edited, { topicId, text: "Replacement AI draft", now: "2026-01-03T00:00:00.000Z" })
    const restored = await restoreRevision(regenerated, { revision: 2, now: "2026-01-04T00:00:00.000Z" })
    const imported = await importOtterNest(structuredClone(SYNTHETIC_OTTER_NEST_FIXTURE), { projectId: "legacy-1", now: "2026-01-05T00:00:00.000Z", inputProvenance: "synthetic-fixture" })

    // Then
    expect(effectiveSectionText(regenerated, topicId)).toBe("Teacher-approved wording")
    expect(regenerated.canonicalCopy.sections.slice(1).map((section) => section.semanticHash)).toEqual(baselineOtherHashes)
    expect(restored.projectRevision).toBe(4)
    expect(effectiveSectionText(restored, topicId)).toBe("Teacher-approved wording")
    expect(imported.report.confirmationRequired).toBe(true)
    expect(imported.report.unmappedEndingCard?.cardNo).toBe(8)
  })
})
