import {z} from 'zod'
import {newsletterProjectSchema} from './schema'
import {newsletterDesignStateSchema} from './rendering/designSchema'
import {NEWSLETTER_COMPATIBILITY_MESSAGE} from '../../electron-p0/protocol'

// The output contract of every supported object forbids additional properties.
// Re-importing it gives a strict, non-transforming input validator. The original
// schemas still perform their existing normalization and semantic checks later.
// No feature blacklist: all objects, unions, enums and revision snapshots follow
// the actual supported schemas. Nothing from this validation result is saved.
const supportedDocument = z.fromJSONSchema(z.toJSONSchema(z.object({
  project:newsletterProjectSchema,
  design:newsletterDesignStateSchema,
})))
export class NewsletterCompatibilityError extends Error {
  readonly name = 'NewsletterCompatibilityError'
  constructor(){super(NEWSLETTER_COMPATIBILITY_MESSAGE)}
}
export function assertNewsletterCompatibility(input:unknown):void {
  if(!supportedDocument.safeParse(input).success)throw new NewsletterCompatibilityError()
}
