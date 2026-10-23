import { describe, expect, it } from "vitest"
import { applyUserEdit, effectiveSectionText, regenerateSection, removeUserEdit, restoreRevision } from "./editing"
import { createNewsletterProject } from "./project"

describe("newsletter editing", () => {
  it("preserves a user overlay and non-target hashes during regeneration", async () => {
    // Given
    const original = await createNewsletterProject({ projectId: "project-1", title: "Synthetic newsletter", now: "2026-01-01T00:00:00.000Z" })
    const topicId = original.topics[0]?.id
    if (topicId === undefined) throw new Error("test fixture has no topic")
    const edited = await applyUserEdit(original, { topicId, text: "Teacher edit", now: "2026-01-02T00:00:00.000Z" })
    const untouchedHashes = edited.canonicalCopy.sections.slice(1).map((section) => section.semanticHash)

    // When
    const regenerated = await regenerateSection(edited, { topicId, text: "New AI draft", now: "2026-01-03T00:00:00.000Z" })

    // Then
    expect(regenerated.canonicalCopy.sections[0]?.userEdit?.text).toBe("Teacher edit")
    expect(effectiveSectionText(regenerated, topicId)).toBe("Teacher edit")
    expect(regenerated.canonicalCopy.sections[0]?.aiGenerated.text).toBe("New AI draft")
    expect(regenerated.canonicalCopy.sections.slice(1).map((section) => section.semanticHash)).toEqual(untouchedHashes)
  })

  it("returns to AI copy after removing the user overlay", async () => {
    // Given
    const original = await createNewsletterProject({ projectId: "project-1", title: "Synthetic newsletter", now: "2026-01-01T00:00:00.000Z" })
    const topicId = original.topics[0]?.id
    if (topicId === undefined) throw new Error("test fixture has no topic")
    const edited = await applyUserEdit(original, { topicId, text: "Teacher edit", now: "2026-01-02T00:00:00.000Z" })

    // When
    const cleared = await removeUserEdit(edited, { topicId, now: "2026-01-03T00:00:00.000Z" })

    // Then
    expect(cleared.canonicalCopy.sections[0]?.userEdit).toBeUndefined()
    expect(effectiveSectionText(cleared, topicId)).toBe("Synthetic sleep copy")
  })

  it("restores a snapshot as a new revision without rewriting history", async () => {
    // Given
    const original = await createNewsletterProject({ projectId: "project-1", title: "Synthetic newsletter", now: "2026-01-01T00:00:00.000Z" })
    const topicId = original.topics[0]?.id
    if (topicId === undefined) throw new Error("test fixture has no topic")
    const edited = await applyUserEdit(original, { topicId, text: "Teacher edit", now: "2026-01-02T00:00:00.000Z" })

    // When
    const restored = await restoreRevision(edited, { revision: 1, now: "2026-01-03T00:00:00.000Z" })

    // Then
    expect(restored.projectRevision).toBe(3)
    expect(restored.revisionHistory).toHaveLength(3)
    expect(restored.revisionHistory[2]?.restoredFromRevision).toBe(1)
    expect(restored.canonicalCopy.sections[0]?.userEdit).toBeUndefined()
  })
})
