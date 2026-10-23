import { z } from "zod"

const schoolTypeSchema = z.enum(["girls-high", "boys-high", "coed-high"])
const candidateSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  title: z.string().trim().min(1),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  schoolType: schoolTypeSchema,
  source: z.object({ kind: z.literal("local-fixture"), label: z.string().min(1), reference: z.string().min(1) }).readonly(),
  reviewStatus: z.enum(["pending", "reviewed", "rejected"]),
}).readonly()

export type TopicCandidate = z.infer<typeof candidateSchema>
export type TopicBank = readonly TopicCandidate[]
export type TopicQuery = Readonly<Pick<TopicCandidate, "year" | "month" | "schoolType">>

export class TopicBankCollisionError extends Error {
  readonly name = "TopicBankCollisionError"
  constructor(readonly collision: "id" | "title", readonly value: string) {
    super(`topic bank ${collision} collision: ${value}`)
  }
}

export function createTopicBank(input: unknown): TopicBank {
  const candidates = z.array(candidateSchema).parse(input)
  const ids = new Set<string>()
  const titles = new Set<string>()
  for (const candidate of candidates) {
    if (ids.has(candidate.id)) throw new TopicBankCollisionError("id", candidate.id)
    ids.add(candidate.id)
    const normalizedTitle = candidate.title.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US")
    const titleKey = `${candidate.year}:${candidate.month}:${candidate.schoolType}:${normalizedTitle}`
    if (titles.has(titleKey)) throw new TopicBankCollisionError("title", normalizedTitle)
    titles.add(titleKey)
  }
  return [...candidates].sort((left, right) => left.id.localeCompare(right.id))
}

export function queryTopicBank(bank: TopicBank, query: TopicQuery): TopicBank {
  return bank.filter((candidate) => candidate.year === query.year && candidate.month === query.month && candidate.schoolType === query.schoolType)
}

export const LOCAL_TOPIC_FIXTURE = createTopicBank([
  { id: "fixture-sleep", title: "Healthy sleep routine", year: 2026, month: 3, schoolType: "girls-high", source: { kind: "local-fixture", label: "Synthetic NS-2 fixture", reference: "docs/newsletter/topic-bank.md" }, reviewStatus: "pending" },
  { id: "fixture-hygiene", title: "Everyday hygiene", year: 2026, month: 3, schoolType: "boys-high", source: { kind: "local-fixture", label: "Synthetic NS-2 fixture", reference: "docs/newsletter/topic-bank.md" }, reviewStatus: "pending" },
  { id: "fixture-exercise", title: "Balanced movement", year: 2026, month: 3, schoolType: "coed-high", source: { kind: "local-fixture", label: "Synthetic NS-2 fixture", reference: "docs/newsletter/topic-bank.md" }, reviewStatus: "pending" },
])
