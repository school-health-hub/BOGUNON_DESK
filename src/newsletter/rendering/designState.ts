import { parseNewsletterDesignState, type CardDesignLayout, type DesignSnapshot, type NewsletterDesignState, type TextStyle } from "./designSchema"

export class DesignCardNotFoundError extends Error {
  readonly name = "DesignCardNotFoundError"
  constructor(readonly cardIndex: number) {
    super(`design card not found: ${cardIndex}`)
  }
}

export class DesignRevisionNotFoundError extends Error {
  readonly name = "DesignRevisionNotFoundError"
  constructor(readonly revision: number) {
    super(`design revision not found: ${revision}`)
  }
}

type CardPatch = {
  readonly background?: string
  readonly titleStyle?: Partial<TextStyle>
  readonly bodyStyle?: Partial<TextStyle>
  readonly titleFrame?: Partial<CardDesignLayout["titleFrame"]>
  readonly bodyFrame?: Partial<CardDesignLayout["bodyFrame"]>
}

type UpdateCardInput = {
  readonly cardIndex: number
  readonly patch: CardPatch
  readonly now: string
}

function snapshotOf(design: NewsletterDesignState, cardLayouts: readonly CardDesignLayout[]): DesignSnapshot {
  return {
    canonicalProjectRevision: design.canonicalProjectRevision,
    templateId: design.templateId,
    templateVersion: design.templateVersion,
    publicationMeta: design.publicationMeta,
    a4Layout: design.a4Layout,
    cardLayouts,
    assetManifest: design.assetManifest,
  }
}

function appendDesignRevision(design: NewsletterDesignState, snapshot: DesignSnapshot, changedPageIds: readonly string[], now: string, restoredFromRevision?: number): NewsletterDesignState {
  const revision = design.designRevision + 1
  const entry = { revision, createdAt: now, changedPageIds, snapshot, ...(restoredFromRevision === undefined ? {} : { restoredFromRevision }) }
  return parseNewsletterDesignState({ ...design, designRevision: revision, ...snapshot, revisionHistory: [...design.revisionHistory, entry] })
}

export function updateCardLayout(design: NewsletterDesignState, input: UpdateCardInput): NewsletterDesignState {
  const target = design.cardLayouts[input.cardIndex]
  if (target === undefined) throw new DesignCardNotFoundError(input.cardIndex)
  const updated = {
    ...target,
    ...(input.patch.background === undefined ? {} : { background: input.patch.background }),
    titleFrame: { ...target.titleFrame, ...input.patch.titleFrame },
    bodyFrame: { ...target.bodyFrame, ...input.patch.bodyFrame },
    titleStyle: { ...target.titleStyle, ...input.patch.titleStyle },
    bodyStyle: { ...target.bodyStyle, ...input.patch.bodyStyle },
  }
  const cardLayouts = design.cardLayouts.map((card, index) => index === input.cardIndex ? updated : card)
  return appendDesignRevision(design, snapshotOf(design, cardLayouts), [target.pageId], input.now)
}

export function restoreDesignRevision(design: NewsletterDesignState, input: { readonly revision: number; readonly now: string }): NewsletterDesignState {
  const source = design.revisionHistory.find((entry) => entry.revision === input.revision)
  if (source === undefined) throw new DesignRevisionNotFoundError(input.revision)
  return appendDesignRevision(design, structuredClone(source.snapshot), ["a4-page", ...source.snapshot.cardLayouts.map((card) => card.pageId)], input.now, source.revision)
}
