import { semanticHash } from "./hash"
import { parseNewsletterProject, type NewsletterProject } from "./schema"

type CreateProjectInput = {
  readonly projectId: string
  readonly title: string
  readonly now: string
  readonly topics?: readonly { readonly id: string; readonly title: string; readonly text?: string }[]
}

const DEFAULT_TOPICS = ["sleep", "nutrition", "exercise", "hygiene", "mind", "safety"] as const

export async function createNewsletterProject(input: CreateProjectInput): Promise<NewsletterProject> {
  const topics = input.topics ?? DEFAULT_TOPICS.map((id) => ({ id, title: id, text: `Synthetic ${id} copy` }))
  const sections = await Promise.all(topics.map(async (topic) => {
    const aiGenerated = { text: topic.text ?? "", generatedAt: input.now }
    return { id: `section-${topic.id}`, topicId: topic.id, aiGenerated, revision: 1, semanticHash: await semanticHash(aiGenerated) }
  }))
  const canonicalCopy = { sections }
  return parseNewsletterProject({
    schemaVersion: 1,
    projectId: input.projectId,
    title: input.title,
    projectRevision: 1,
    topics: topics.map(({ id, title }) => ({ id, title })),
    canonicalCopy,
    a4Layout: { sectionRefs: sections.map((section) => section.id) },
    cardLayouts: [{ kind: "cover", title: input.title }, ...sections.map((section) => ({ kind: "topic", topicId: section.topicId, sectionRef: section.id }))],
    revisionHistory: [{ revision: 1, createdAt: input.now, changedSectionIds: sections.map((section) => section.id), snapshot: canonicalCopy }],
    outputHistory: [],
  })
}
