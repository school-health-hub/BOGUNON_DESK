import { invoke } from "@tauri-apps/api/core"
import { z } from "zod"
import { parseNewsletterProject, parseRevisionHistory, type NewsletterProject } from "./schema"

const isoTimestampSchema = z.iso.datetime()

export class NewsletterRepositoryError extends Error {
  readonly name = "NewsletterRepositoryError"
  constructor(readonly operation: string) {
    super(`newsletter repository operation failed: ${operation}`)
  }
}

async function callNative<T>(command: string, payload: Readonly<Record<string, unknown>>): Promise<T> {
  try {
    return await invoke<T>(command, payload)
  } catch {
    throw new NewsletterRepositoryError(command)
  }
}

export class NewsletterProjectRepository {
  async create(project: NewsletterProject): Promise<NewsletterProject> {
    const result = await callNative<unknown>("newsletter_project_create", { project })
    return parseNewsletterProject(result)
  }

  async get(projectId: string): Promise<NewsletterProject> {
    const result = await callNative<unknown>("newsletter_project_get", { projectId })
    return parseNewsletterProject(result)
  }

  async save(project: NewsletterProject): Promise<void> {
    await callNative<void>("newsletter_project_save", { project })
  }

  async update(project: NewsletterProject): Promise<NewsletterProject> {
    const result = await callNative<unknown>("newsletter_project_update", { project })
    return parseNewsletterProject(result)
  }

  async clone(projectId: string, newProjectId: string, createdAt: string): Promise<NewsletterProject> {
    const parsedCreatedAt = isoTimestampSchema.parse(createdAt)
    const result = await callNative<unknown>("newsletter_project_clone", { sourceProjectId: projectId, newProjectId, createdAt: parsedCreatedAt })
    return parseNewsletterProject(result)
  }

  async revisionHistory(projectId: string): Promise<NewsletterProject["revisionHistory"]> {
    const result = await callNative<unknown>("newsletter_project_list_revisions", { projectId })
    return parseRevisionHistory(result)
  }

  async restore(projectId: string, revision: number, restoredAt: string): Promise<NewsletterProject> {
    const parsedRestoredAt = isoTimestampSchema.parse(restoredAt)
    const result = await callNative<unknown>("newsletter_project_restore", { projectId, revision, restoredAt: parsedRestoredAt })
    return parseNewsletterProject(result)
  }
}
