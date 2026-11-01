import { applyUserEdit } from "../editing"
import { parseNewsletterProject, type NewsletterProject } from "../schema"
import { parseNewsletterDesignStateV2, type NewsletterDesignStateV2 } from "./designSchema"
import { structureCanonicalText } from "./contentStructure"

export function selectedSection(project: NewsletterProject, revision: number, topicIndex: number) {
  return project.revisionHistory.find((entry) => entry.revision === revision)?.snapshot.sections[topicIndex]
}
export function editorialActionCount(project: NewsletterProject, revision: number, topicIndex: number): number {
  const section = selectedSection(project, revision, topicIndex)
  if (section === undefined) return 0
  const content = structureCanonicalText(section.userEdit?.text ?? section.aiGenerated.text)
  return content.kind === "list" ? content.actions.length : 0
}
export function updateEditorialTitle(project: NewsletterProject, topicIndex: number | undefined, title: string): NewsletterProject {
  if (title.trim().length === 0) return project
  return parseNewsletterProject(topicIndex === undefined ? { ...project, title, cardLayouts: project.cardLayouts.map((card) => card.kind === "cover" ? { ...card, title } : card) } : { ...project, topics: project.topics.map((topic, index) => index === topicIndex ? { ...topic, title } : topic) })
}
export async function editEditorialSection(project: NewsletterProject, design: NewsletterDesignStateV2, topicIndex: number, text: string, now: string) {
  const topic = project.topics[topicIndex]
  if (topic === undefined) return { project, design }
  const nextProject = await applyUserEdit(project, { topicId: topic.id, text, now })
  const canonicalProjectRevision = nextProject.projectRevision
  const revision = design.designRevision + 1
  const snapshot = { ...design, canonicalProjectRevision }
  const nextDesign = parseNewsletterDesignStateV2({ ...design, canonicalProjectRevision, designRevision: revision, revisionHistory: [...design.revisionHistory, { revision, createdAt: now, changedPageIds: ["a4-page", design.cardLayouts[topicIndex + 1]?.pageId ?? "card-cover"], snapshotVersion: 2, snapshot }] })
  return { project: nextProject, design: nextDesign }
}
