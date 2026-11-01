import { semanticHash } from "./hash"
import { parseNewsletterProject, type CanonicalCopy, type NewsletterProject, type TopicId } from "./schema"

type SectionChange = { readonly topicId: TopicId; readonly text: string; readonly now: string }
type RestoreInput = { readonly revision: number; readonly now: string }

async function updateSection(project: NewsletterProject, change: SectionChange, kind: "user" | "ai"): Promise<NewsletterProject> {
  const target = project.canonicalCopy.sections.find((section) => section.topicId === change.topicId)
  if (target === undefined) throw new NewsletterSectionNotFoundError(change.topicId)
  const sections = await Promise.all(project.canonicalCopy.sections.map(async (section) => {
    if (section.topicId !== change.topicId) return section
    const aiGenerated = kind === "ai" ? { text: change.text, generatedAt: change.now } : section.aiGenerated
    const userEdit = kind === "user" ? { text: change.text, editedAt: change.now } : section.userEdit
    return { ...section, aiGenerated, userEdit, revision: section.revision + 1, semanticHash: await semanticHash({ aiGenerated, userEdit }) }
  }))
  return appendRevision(project, { sections }, [target.id], change.now)
}

function appendRevision(project: NewsletterProject, canonicalCopy: CanonicalCopy, changedSectionIds: readonly string[], now: string, restoredFromRevision?: number): NewsletterProject {
  const revision = project.projectRevision + 1
  const entry = { revision, createdAt: now, changedSectionIds, snapshot: canonicalCopy, ...(restoredFromRevision === undefined ? {} : { restoredFromRevision }) }
  return parseNewsletterProject({ ...project, projectRevision: revision, canonicalCopy, revisionHistory: [...project.revisionHistory, entry] })
}

export class NewsletterSectionNotFoundError extends Error {
  readonly name = "NewsletterSectionNotFoundError"
  constructor(readonly topicId: string) {
    super(`newsletter section not found: ${topicId}`)
  }
}

export class NewsletterRevisionNotFoundError extends Error {
  readonly name = "NewsletterRevisionNotFoundError"
  constructor(readonly revision: number) {
    super(`newsletter revision not found: ${revision}`)
  }
}

export async function applyUserEdit(project: NewsletterProject, change: SectionChange): Promise<NewsletterProject> {
  return updateSection(project, change, "user")
}

export async function regenerateSection(project: NewsletterProject, change: SectionChange): Promise<NewsletterProject> {
  return updateSection(project, change, "ai")
}

export async function removeUserEdit(project: NewsletterProject, input: { readonly topicId: TopicId; readonly now: string }): Promise<NewsletterProject> {
  const target = project.canonicalCopy.sections.find((section) => section.topicId === input.topicId)
  if (target === undefined) throw new NewsletterSectionNotFoundError(input.topicId)
  const sections = await Promise.all(project.canonicalCopy.sections.map(async (section) => {
    if (section.topicId !== input.topicId) return section
    const { userEdit: _userEdit, ...withoutUserEdit } = section
    return { ...withoutUserEdit, revision: section.revision + 1, semanticHash: await semanticHash(section.aiGenerated) }
  }))
  return appendRevision(project, { sections }, [target.id], input.now)
}

export function effectiveSectionText(project: NewsletterProject, topicId: TopicId): string {
  const section = project.canonicalCopy.sections.find((candidate) => candidate.topicId === topicId)
  if (section === undefined) throw new NewsletterSectionNotFoundError(topicId)
  return section.userEdit?.text ?? section.aiGenerated.text
}

export async function restoreRevision(project: NewsletterProject, input: RestoreInput): Promise<NewsletterProject> {
  const source = project.revisionHistory.find((entry) => entry.revision === input.revision)
  if (source === undefined) throw new NewsletterRevisionNotFoundError(input.revision)
  const changedSectionIds = source.snapshot.sections.map((section) => section.id)
  return appendRevision(project, structuredClone(source.snapshot), changedSectionIds, input.now, source.revision)
}

export function appendOutput(project: NewsletterProject, output: NewsletterProject["outputHistory"][number]): NewsletterProject {
  return parseNewsletterProject({ ...project, outputHistory: [...project.outputHistory, output] })
}
