import { describe, expect, it } from "vitest"
import { semanticHash } from "./hash"
import { createNewsletterProject } from "./project"
import { parseNewsletterProject, type NewsletterProject } from "./schema"

describe("NewsletterProject schema v1", () => {
  it("round-trips a valid six-topic seven-card project", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "project-1", title: "Synthetic newsletter", now: "2026-01-01T00:00:00.000Z" })

    // When
    const parsed = parseNewsletterProject(JSON.parse(JSON.stringify(project)))

    // Then
    expect(parsed).toEqual(project)
    expect(parsed.cardLayouts).toHaveLength(7)
    expect(parsed.a4Layout.sectionRefs).toEqual(parsed.cardLayouts.flatMap((card) => card.kind === "topic" ? [card.sectionRef] : []))
  })

  it.each<readonly [string, (project: NewsletterProject) => unknown]>([
    ["future schema", (project) => ({ ...project, schemaVersion: 2 })],
    ["six topics required", (project) => ({ ...project, topics: [] })],
    ["duplicate topic ids", (project) => ({ ...project, topics: project.topics.map(() => project.topics[0]) })],
    ["cover first", (project) => ({ ...project, cardLayouts: [...project.cardLayouts].reverse() })],
    ["existing output revision", (project) => ({ ...project, outputHistory: [{ id: "output-1", projectRevision: 99, format: "a4", createdAt: "2026-01-01T00:00:00.000Z" }] })],
  ])("rejects %s", async (_name, mutate) => {
    // Given
    const project = await createNewsletterProject({ projectId: "project-1", title: "Synthetic newsletter", now: "2026-01-01T00:00:00.000Z" })

    // When
    const result = () => parseNewsletterProject(mutate(project))

    // Then
    expect(result).toThrow()
  })

  it.each<readonly [string, (project: NewsletterProject) => unknown]>([
    ["snapshot topic mismatch", (project) => ({ ...project, revisionHistory: [{ ...project.revisionHistory[0], snapshot: { sections: project.revisionHistory[0]?.snapshot.sections.map((section, index) => index === 0 ? { ...section, topicId: project.topics[1]?.id } : section) } }] })],
    ["unknown changed section", (project) => ({ ...project, revisionHistory: [{ ...project.revisionHistory[0], changedSectionIds: ["section-unknown"] }] })],
    ["restore from current revision", (project) => ({ ...project, revisionHistory: [{ ...project.revisionHistory[0], restoredFromRevision: 1 }] })],
  ])("rejects malformed revision history: %s", async (_name, mutate) => {
    // Given
    const project = await createNewsletterProject({ projectId: "project-1", title: "Synthetic newsletter", now: "2026-01-01T00:00:00.000Z" })

    // When
    const result = () => parseNewsletterProject(mutate(project))

    // Then
    expect(result).toThrow()
  })

  it("rejects tampered section text with a forged well-formed hash", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "project-1", title: "Synthetic newsletter", now: "2026-01-01T00:00:00.000Z" })
    const first = project.canonicalCopy.sections[0]
    if (first === undefined) throw new Error("test fixture has no section")
    const tampered = {
      ...project,
      canonicalCopy: { sections: [{ ...first, aiGenerated: { ...first.aiGenerated, text: "Tampered" }, semanticHash: "0".repeat(64) }, ...project.canonicalCopy.sections.slice(1)] },
    }

    // When
    const result = () => parseNewsletterProject(tampered)

    // Then
    expect(result).toThrow("section semantic hash")
  })

  it("rejects a current copy that differs from the final valid snapshot", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "project-1", title: "Synthetic newsletter", now: "2026-01-01T00:00:00.000Z" })
    const first = project.canonicalCopy.sections[0]
    if (first === undefined) throw new Error("test fixture has no section")
    const aiGenerated = { ...first.aiGenerated, text: "Valid but not snapshotted" }
    const changed = { ...first, aiGenerated, semanticHash: await semanticHash(aiGenerated) }

    // When
    const result = () => parseNewsletterProject({ ...project, canonicalCopy: { sections: [changed, ...project.canonicalCopy.sections.slice(1)] } })

    // Then
    expect(result).toThrow("final revision snapshot")
  })

  it("round-trips optional native clone provenance", async () => {
    // Given
    const project = await createNewsletterProject({ projectId: "clone-1", title: "Synthetic clone", now: "2026-01-01T00:00:00.000Z" })
    const withProvenance = { ...project, cloneProvenance: { sourceProjectId: "source-project", sourceRevision: 4 } }

    // When
    const parsed = parseNewsletterProject(withProvenance)

    // Then
    expect(parsed.cloneProvenance).toEqual({ sourceProjectId: "source-project", sourceRevision: 4 })
  })
})
