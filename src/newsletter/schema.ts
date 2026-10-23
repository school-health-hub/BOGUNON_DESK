import { z } from "zod"
import { canonicalJson, semanticHashSync } from "./hash"

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/)
const topicId = id.brand("TopicId")
const sectionId = id.brand("SectionId")
const projectId = id.brand("ProjectId")
const isoDate = z.iso.datetime()
const hash = z.string().regex(/^[a-f0-9]{64}$/)

const topicSchema = z.object({ id: topicId, title: z.string().trim().min(1) }).readonly()
const aiCopySchema = z.object({ text: z.string(), generatedAt: isoDate }).readonly()
const userEditSchema = z.object({ text: z.string(), editedAt: isoDate }).readonly()
const sectionSchema = z.object({
  id: sectionId,
  topicId,
  aiGenerated: aiCopySchema,
  userEdit: userEditSchema.optional(),
  revision: z.number().int().positive(),
  semanticHash: hash,
}).readonly()
const canonicalCopySchema = z.object({ sections: z.array(sectionSchema).length(6).readonly() }).readonly()
const cardLayoutSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("cover"), title: z.string().min(1) }).readonly(),
  z.object({ kind: z.literal("topic"), topicId, sectionRef: sectionId }).readonly(),
])
const revisionSchema = z.object({
  revision: z.number().int().positive(),
  createdAt: isoDate,
  changedSectionIds: z.array(sectionId).readonly(),
  restoredFromRevision: z.number().int().positive().optional(),
  snapshot: canonicalCopySchema,
}).readonly()
const outputSchema = z.object({
  id,
  projectRevision: z.number().int().positive(),
  format: z.enum(["a4", "cards"]),
  createdAt: isoDate,
}).readonly()

export const newsletterProjectSchema = z.object({
  schemaVersion: z.literal(1),
  projectId,
  title: z.string().trim().min(1),
  projectRevision: z.number().int().positive(),
  cloneProvenance: z.object({ sourceProjectId: projectId, sourceRevision: z.number().int().positive() }).readonly().optional(),
  topics: z.array(topicSchema).length(6).readonly(),
  canonicalCopy: canonicalCopySchema,
  a4Layout: z.object({ sectionRefs: z.array(sectionId).length(6).readonly() }).readonly(),
  cardLayouts: z.array(cardLayoutSchema).length(7).readonly(),
  revisionHistory: z.array(revisionSchema).min(1).readonly(),
  outputHistory: z.array(outputSchema).readonly(),
}).readonly().superRefine((project, context) => {
  const topicIds = project.topics.map((topic) => topic.id)
  const sectionTopicIds = project.canonicalCopy.sections.map((section) => section.topicId)
  const sectionIds = project.canonicalCopy.sections.map((section) => section.id)
  const topicCards = project.cardLayouts.slice(1)
  const historyRevisions = project.revisionHistory.map((entry) => entry.revision)
  const issue = (message: string): void => context.addIssue({ code: "custom", message })

  if (new Set(topicIds).size !== 6) issue("topic ids must be unique")
  if (new Set(sectionIds).size !== 6) issue("section ids must be unique")
  if (sectionTopicIds.join("|") !== topicIds.join("|")) issue("canonical sections must match ordered topic ids")
  if (project.a4Layout.sectionRefs.join("|") !== sectionIds.join("|")) issue("A4 must reference canonical sections")
  if (project.cardLayouts[0]?.kind !== "cover") issue("first card must be cover")
  const cardRefs = topicCards.flatMap((card) => card.kind === "topic" ? [card.sectionRef] : [])
  const cardTopics = topicCards.flatMap((card) => card.kind === "topic" ? [card.topicId] : [])
  if (cardRefs.join("|") !== sectionIds.join("|") || cardTopics.join("|") !== topicIds.join("|")) issue("topic cards must reference canonical sections one-to-one")
  if (historyRevisions.some((revision, index) => revision !== index + 1)) issue("revision history must be contiguous")
  if (historyRevisions[historyRevisions.length - 1] !== project.projectRevision) issue("project revision must match history")
  if (project.outputHistory.some((output) => !historyRevisions.includes(output.projectRevision))) issue("output history references unknown revision")
  const validateHashes = (sections: typeof project.canonicalCopy.sections): void => {
    for (const section of sections) {
      const payload = section.userEdit === undefined ? section.aiGenerated : { aiGenerated: section.aiGenerated, userEdit: section.userEdit }
      if (semanticHashSync(payload) !== section.semanticHash) issue("section semantic hash does not match content")
    }
  }
  validateHashes(project.canonicalCopy.sections)
  for (const entry of project.revisionHistory) {
    const snapshotSections = entry.snapshot.sections
    const snapshotIds = snapshotSections.map((section) => section.id)
    const snapshotTopicIds = snapshotSections.map((section) => section.topicId)
    if (new Set(snapshotIds).size !== 6 || snapshotIds.join("|") !== sectionIds.join("|")) issue("revision snapshot sections must match project sections")
    if (new Set(snapshotTopicIds).size !== 6 || snapshotTopicIds.join("|") !== topicIds.join("|")) issue("revision snapshot topics must match project topics")
    if (entry.changedSectionIds.some((changedId) => !sectionIds.includes(changedId))) issue("revision references unknown changed section")
    if (entry.restoredFromRevision !== undefined && (entry.restoredFromRevision >= entry.revision || !historyRevisions.includes(entry.restoredFromRevision))) issue("restored revision must reference earlier history")
    validateHashes(snapshotSections)
  }
  const finalSnapshot = project.revisionHistory[project.revisionHistory.length - 1]?.snapshot
  if (finalSnapshot !== undefined && canonicalJson(finalSnapshot) !== canonicalJson(project.canonicalCopy)) issue("final revision snapshot must equal current canonical copy")
})

export type NewsletterProject = z.infer<typeof newsletterProjectSchema>
export type TopicId = NewsletterProject["topics"][number]["id"]
export type CanonicalCopy = NewsletterProject["canonicalCopy"]

export function parseNewsletterProject(input: unknown): NewsletterProject {
  return newsletterProjectSchema.parse(input)
}

export function parseRevisionHistory(input: unknown): NewsletterProject["revisionHistory"] {
  return z.array(revisionSchema).readonly().parse(input)
}
