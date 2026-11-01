import { beforeEach, describe, expect, it, vi } from "vitest"

const invoke = vi.fn()
vi.mock("@tauri-apps/api/core", () => ({ invoke }))

describe("NewsletterProjectRepository", () => {
  beforeEach(() => invoke.mockReset())

  it("uses only the native command boundary for save", async () => {
    // Given
    const { createNewsletterProject } = await import("./project")
    const { NewsletterProjectRepository } = await import("./repository")
    invoke.mockResolvedValue(undefined)
    const repository = new NewsletterProjectRepository()
    const project = await createNewsletterProject({ projectId: "project-1", title: "Synthetic newsletter", now: "2026-01-01T00:00:00.000Z" })

    // When
    await repository.save(project)

    // Then
    expect(invoke).toHaveBeenCalledWith("newsletter_project_save", { project })
  })

  it("uses the native update command and parses its response", async () => {
    // Given
    const { createNewsletterProject } = await import("./project")
    const { NewsletterProjectRepository } = await import("./repository")
    const project = await createNewsletterProject({ projectId: "project-1", title: "Synthetic newsletter", now: "2026-01-01T00:00:00.000Z" })
    invoke.mockResolvedValue(project)

    // When
    const result = await new NewsletterProjectRepository().update(project)

    // Then
    expect(result).toEqual(project)
    expect(invoke).toHaveBeenCalledWith("newsletter_project_update", { project })
  })

  it("loads revision history through its dedicated native command", async () => {
    // Given
    const { createNewsletterProject } = await import("./project")
    const { NewsletterProjectRepository } = await import("./repository")
    const project = await createNewsletterProject({ projectId: "project-1", title: "Synthetic newsletter", now: "2026-01-01T00:00:00.000Z" })
    invoke.mockResolvedValue(project.revisionHistory)

    // When
    const result = await new NewsletterProjectRepository().revisionHistory(project.projectId)

    // Then
    expect(result).toEqual(project.revisionHistory)
    expect(invoke).toHaveBeenCalledWith("newsletter_project_list_revisions", { projectId: project.projectId })
  })

  it("passes an explicit creation timestamp when cloning", async () => {
    // Given
    const { createNewsletterProject } = await import("./project")
    const { NewsletterProjectRepository } = await import("./repository")
    const project = await createNewsletterProject({ projectId: "clone-1", title: "Synthetic clone", now: "2026-01-02T00:00:00.000Z" })
    invoke.mockResolvedValue(project)

    // When
    await new NewsletterProjectRepository().clone("project-1", "clone-1", "2026-01-02T00:00:00.000Z")

    // Then
    expect(invoke).toHaveBeenCalledWith("newsletter_project_clone", { sourceProjectId: "project-1", newProjectId: "clone-1", createdAt: "2026-01-02T00:00:00.000Z" })
  })

  it("passes an explicit restoration timestamp when restoring", async () => {
    // Given
    const { createNewsletterProject } = await import("./project")
    const { NewsletterProjectRepository } = await import("./repository")
    const project = await createNewsletterProject({ projectId: "project-1", title: "Synthetic newsletter", now: "2026-01-01T00:00:00.000Z" })
    invoke.mockResolvedValue(project)

    // When
    await new NewsletterProjectRepository().restore("project-1", 1, "2026-01-03T00:00:00.000Z")

    // Then
    expect(invoke).toHaveBeenCalledWith("newsletter_project_restore", { projectId: "project-1", revision: 1, restoredAt: "2026-01-03T00:00:00.000Z" })
  })

  it("rejects an invalid clone timestamp before native invocation", async () => {
    // Given
    const { NewsletterProjectRepository } = await import("./repository")
    const repository = new NewsletterProjectRepository()

    // When
    const result = repository.clone("project-1", "clone-1", "not-a-timestamp")

    // Then
    await expect(result).rejects.toThrow()
    expect(invoke).not.toHaveBeenCalled()
  })

  it("rejects an invalid restore timestamp before native invocation", async () => {
    // Given
    const { NewsletterProjectRepository } = await import("./repository")
    const repository = new NewsletterProjectRepository()

    // When
    const result = repository.restore("project-1", 1, "2026-13-99")

    // Then
    await expect(result).rejects.toThrow()
    expect(invoke).not.toHaveBeenCalled()
  })

  it("rejects a misleading native success payload", async () => {
    // Given
    const { NewsletterProjectRepository } = await import("./repository")
    invoke.mockResolvedValue({ schemaVersion: 1, projectId: "incomplete" })

    // When
    const result = new NewsletterProjectRepository().get("project-1")

    // Then
    await expect(result).rejects.toThrow()
  })

})
