import {z} from 'zod'

export const NEWSLETTER_AI_OUTPUT_CONTRACT=Object.freeze({topicCount:6,actionsPerTopic:4,a4PageCount:1,cardCount:7})
export const NEWSLETTER_AI_MEDIA_LIMITS=Object.freeze({maxBytes:100_000_000,maxDimension:8_192})

const identifier=z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/)
const sha256=z.string().regex(/^[a-f0-9]{64}$/)
const nonEmpty=z.string().trim().min(1).max(4_000)
const provider=z.enum(['openai','gemini','mock'])
const usageSchema=z.object({
  costStatus:z.enum(['estimated','reported','unknown']),
  currency:z.string().regex(/^[A-Z]{3}$/).optional(),
  amount:z.number().nonnegative().finite().optional(),
  inputTokens:z.number().int().nonnegative().optional(),
  outputTokens:z.number().int().nonnegative().optional(),
}).strict().superRefine((usage,context)=>{
  if(usage.costStatus==='unknown'&&(usage.currency!==undefined||usage.amount!==undefined))context.addIssue({code:'custom',message:'unknown cost cannot include an amount'})
  if((usage.currency===undefined)!==(usage.amount===undefined))context.addIssue({code:'custom',message:'currency and amount must be provided together'})
})

export const newsletterAiBaselineSchema=z.object({
  projectId:identifier,
  projectRevision:z.number().int().positive(),
  projectHash:sha256,
  designRevision:z.number().int().positive(),
  designHash:sha256,
}).strict().readonly()

const sourceReferenceSchema=z.object({
  title:z.string().trim().min(1).max(500),
  publisher:z.string().trim().min(1).max(200),
  url:z.url().max(2_000).optional(),
  sha256:sha256.optional(),
}).strict().readonly()

const visualConceptSchema=z.object({
  summary:z.string().trim().min(1).max(2_000),
  containsEditableKoreanText:z.literal(false),
}).strict().readonly()

export const newsletterAiTopicProposalSchema=z.object({
  id:identifier,
  title:z.string().trim().min(1).max(200),
  lead:z.string().trim().min(1).max(500),
  actions:z.array(nonEmpty).length(NEWSLETTER_AI_OUTPUT_CONTRACT.actionsPerTopic).readonly(),
  closing:z.string().trim().min(1).max(500),
  sources:z.array(sourceReferenceSchema).max(20).readonly(),
  currentFactReview:z.enum(['verified-source-selected','verification-required']),
  visualConcept:visualConceptSchema.optional(),
}).strict().readonly()

export const newsletterAiProposalSchema=z.object({
  schemaVersion:z.literal(1),
  proposalId:identifier,
  provider,
  model:z.string().trim().min(1).max(200),
  mock:z.boolean(),
  month:z.number().int().min(1).max(12),
  schoolType:z.enum(['girls','boys','coeducational']),
  baseline:newsletterAiBaselineSchema,
  topics:z.array(newsletterAiTopicProposalSchema).length(NEWSLETTER_AI_OUTPUT_CONTRACT.topicCount).readonly(),
  requestId:identifier,
  promptHash:sha256,
  usage:usageSchema,
}).strict().superRefine((proposal,context)=>{
  const ids=proposal.topics.map(topic=>topic.id)
  if(new Set(ids).size!==ids.length)context.addIssue({code:'custom',message:'topic IDs must be unique'})
})

export const newsletterAiTopicRegenerationSchema=z.object({
  schemaVersion:z.literal(1),kind:z.literal('topic-regeneration'),proposalId:identifier,targetTopicId:identifier,
  proposalHash:sha256,topicHash:sha256,provider,model:z.string().trim().min(1).max(200),mock:z.boolean(),
  baseline:newsletterAiBaselineSchema,topic:newsletterAiTopicProposalSchema,requestId:identifier,promptHash:sha256,usage:usageSchema,
}).strict().superRefine((result,context)=>{
  if(result.topic.id!==result.targetTopicId)context.addIssue({code:'custom',message:'regenerated topic ID must match the requested target'})
})

const consentFileSchema=z.object({
  name:z.string().trim().min(1).max(255).refine(name=>!/[\\/]/.test(name),'name must be a base name'),
  sha256,
  byteSize:z.number().int().nonnegative().max(NEWSLETTER_AI_MEDIA_LIMITS.maxBytes),
  purpose:z.string().trim().min(1).max(500),
}).strict().readonly()

export const newsletterAiConsentManifestSchema=z.object({
  schemaVersion:z.literal(1),
  requestId:identifier,
  operation:z.enum(['generate-text','generate-image','edit-image']),
  provider,
  model:z.string().trim().min(1).max(200),
  mock:z.boolean(),
  files:z.array(consentFileSchema).max(32).readonly(),
  cost:z.object({
    status:z.enum(['estimated','reported','unknown']),
    currency:z.string().regex(/^[A-Z]{3}$/).optional(),
    amount:z.number().nonnegative().finite().optional(),
  }).strict().superRefine((cost,context)=>{
    if(cost.status==='unknown'&&(cost.currency!==undefined||cost.amount!==undefined))context.addIssue({code:'custom',message:'unknown cost cannot include an amount'})
    if((cost.currency===undefined)!==(cost.amount===undefined))context.addIssue({code:'custom',message:'currency and amount must be provided together'})
  }),
  noRecallAfterTransmission:z.literal(true),
  consentedAt:z.iso.datetime(),
}).strict().readonly()

export const newsletterAiImageCandidateSchema=z.object({
  schemaVersion:z.literal(1),
  candidateId:identifier,
  assetType:z.literal('AI_GENERATED'),
  exportApproval:z.literal('pending'),
  provider,
  model:z.string().trim().min(1).max(200),
  mock:z.boolean(),
  requestId:identifier,
  createdAt:z.iso.datetime(),
  promptHash:sha256,
  inputHashes:z.array(sha256).max(32).readonly(),
  outputHash:sha256,
  mediaType:z.enum(['image/png','image/jpeg','image/webp']),
  byteSize:z.number().int().positive().max(NEWSLETTER_AI_MEDIA_LIMITS.maxBytes),
  width:z.number().int().positive().max(NEWSLETTER_AI_MEDIA_LIMITS.maxDimension),
  height:z.number().int().positive().max(NEWSLETTER_AI_MEDIA_LIMITS.maxDimension),
  baseline:newsletterAiBaselineSchema,
  usage:usageSchema,
}).strict().readonly()

export const newsletterAiFailureSchema=z.object({
  status:z.enum(['cancelled','declined','timeout','provider-error','invalid-response','unsupported','stale-baseline']),
  safeMessage:z.string().trim().min(1).max(500),
  transmissionStarted:z.boolean(),
  retryAllowed:z.boolean(),
}).strict().readonly()

const boundedCapability=z.object({
  generate:z.boolean(),
  structuredOutput:z.boolean(),
  maxInputBytes:z.number().int().nonnegative(),
}).strict().readonly()

const imageCapability=z.object({
  generate:z.boolean(),
  edit:z.boolean(),
  referenceInput:z.boolean(),
  maxInputBytes:z.number().int().nonnegative(),
  maxOutputBytes:z.number().int().nonnegative().max(NEWSLETTER_AI_MEDIA_LIMITS.maxBytes),
  maxDimension:z.number().int().nonnegative().max(NEWSLETTER_AI_MEDIA_LIMITS.maxDimension),
}).strict().superRefine((image,context)=>{
  if(image.generate&&(image.maxOutputBytes===0||image.maxDimension===0))context.addIssue({code:'custom',message:'enabled image generation requires explicit output bounds'})
  if(!image.generate&&(image.edit||image.referenceInput))context.addIssue({code:'custom',message:'image editing requires generation capability'})
})

export const newsletterAiProviderCapabilitySchema=z.object({
  provider:z.enum(['openai','gemini']),
  model:z.string().trim().min(1).max(200),
  text:boundedCapability,
  image:imageCapability,
}).strict().readonly()

const patchField=z.enum(['title','lead','actions','closing','sources','currentFactReview','visualConcept','imageCandidate'])
const patchSelectionSchema=z.object({
  topicId:identifier,
  fields:z.array(patchField).min(1).max(8).refine(fields=>new Set(fields).size===fields.length,'patch fields must be unique').readonly(),
}).strict().readonly()

export const newsletterAiPatchSchema=z.object({
  schemaVersion:z.literal(1),
  proposalId:identifier,
  baseline:newsletterAiBaselineSchema,
  selections:z.array(patchSelectionSchema).min(1).max(NEWSLETTER_AI_OUTPUT_CONTRACT.topicCount).readonly(),
}).strict().superRefine((patch,context)=>{
  const topicIds=patch.selections.map(selection=>selection.topicId)
  if(new Set(topicIds).size!==topicIds.length)context.addIssue({code:'custom',message:'patch topic IDs must be unique'})
})

export type NewsletterAiProposal=z.infer<typeof newsletterAiProposalSchema>
export type NewsletterAiTopicRegeneration=z.infer<typeof newsletterAiTopicRegenerationSchema>
export type NewsletterAiTextResult=NewsletterAiProposal|NewsletterAiTopicRegeneration
export type NewsletterAiConsentManifest=z.infer<typeof newsletterAiConsentManifestSchema>
export type NewsletterAiImageCandidate=z.infer<typeof newsletterAiImageCandidateSchema>
export type NewsletterAiBaseline=z.infer<typeof newsletterAiBaselineSchema>
export type NewsletterAiProviderCapability=z.infer<typeof newsletterAiProviderCapabilitySchema>
export type NewsletterAiPatch=z.infer<typeof newsletterAiPatchSchema>

export class NewsletterAiContractError extends Error{
  constructor(){super('AI 생성 결과가 보건소식지 계약과 일치하지 않습니다.');this.name='NewsletterAiContractError'}
}

function parseSafely<T>(schema:z.ZodType<T>,input:unknown):T{
  const result=schema.safeParse(input)
  if(!result.success)throw new NewsletterAiContractError()
  return result.data
}

export const parseNewsletterAiProposal=(input:unknown):NewsletterAiProposal=>parseSafely(newsletterAiProposalSchema,input)
export const parseNewsletterAiTopicRegeneration=(input:unknown):NewsletterAiTopicRegeneration=>parseSafely(newsletterAiTopicRegenerationSchema,input)
export const parseNewsletterAiConsentManifest=(input:unknown):NewsletterAiConsentManifest=>parseSafely(newsletterAiConsentManifestSchema,input)
export const parseNewsletterAiImageCandidate=(input:unknown):NewsletterAiImageCandidate=>parseSafely(newsletterAiImageCandidateSchema,input)
export const parseNewsletterAiProviderCapability=(input:unknown):NewsletterAiProviderCapability=>parseSafely(newsletterAiProviderCapabilitySchema,input)
export const parseNewsletterAiPatch=(input:unknown):NewsletterAiPatch=>parseSafely(newsletterAiPatchSchema,input)
