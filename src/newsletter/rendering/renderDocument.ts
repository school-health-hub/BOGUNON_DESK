import { parseNewsletterProject, type NewsletterProject } from "../schema"
import { parseNewsletterDesignState, type DesignSnapshot, type NewsletterDesignState, type TextStyle } from "./designSchema"
import { layoutText, type TextMeasurer } from "./typography"

export class RenderRevisionNotFoundError extends Error {
  readonly name = "RenderRevisionNotFoundError"
  constructor(readonly kind: "project" | "design", readonly revision: number) {
    super(`${kind} revision not found: ${revision}`)
  }
}

export class RenderContractMismatchError extends Error {
  readonly name = "RenderContractMismatchError"
  constructor(readonly reason: string) {
    super(`render contract mismatch: ${reason}`)
  }
}

export class RenderAssetNotApprovedError extends Error {
  readonly name = "RenderAssetNotApprovedError"
  constructor(readonly assetId: string) {
    super(`render asset is not approved: ${assetId}`)
  }
}

export type RenderTextBlock = {
  readonly id: string
  readonly text: string
  readonly lines: readonly string[]
  readonly frame: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  readonly style: TextStyle
}

export type RenderIssue = {
  readonly kind: "overflow" | "missing-text"
  readonly pageId: string
  readonly blockId: string
  readonly message: string
}

export type RenderPage = {
  readonly pageId: string
  readonly width: number
  readonly height: number
  readonly background: string
  readonly title: RenderTextBlock
  readonly body: RenderTextBlock
  readonly image: { readonly slotId: string; readonly assetId?: string; readonly frame: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }; readonly fit: "contain" | "cover" }
}

export type RenderDocument = {
  readonly projectId: string
  readonly projectRevision: number
  readonly designRevision: number
  readonly a4: {
    readonly pageId: "a4-page"
    readonly width: 1240
    readonly height: 1754
    readonly exportWidth: 2480
    readonly exportHeight: 3508
    readonly safeMargin: 59
    readonly background: string
    readonly title: RenderTextBlock
    readonly publicationMeta: RenderTextBlock
    readonly modules: readonly { readonly topicId: string; readonly sectionId: string; readonly title: RenderTextBlock; readonly body: RenderTextBlock; readonly image: RenderPage["image"] }[]
    readonly footer: RenderTextBlock
  }
  readonly cards: readonly RenderPage[]
  readonly issues: readonly RenderIssue[]
}

type CompileInput = {
  readonly project: NewsletterProject
  readonly projectRevision: number
  readonly design: NewsletterDesignState
  readonly designRevision: number
  readonly measureText?: TextMeasurer
}

function block(id: string, pageId: string, text: string, frame: RenderTextBlock["frame"], style: TextStyle, issues: RenderIssue[], measureText?: TextMeasurer): RenderTextBlock {
  const layout = layoutText(text, style, frame, measureText)
  if (text.trim().length === 0) issues.push({ kind: "missing-text", pageId, blockId: id, message: "필수 텍스트가 비어 있습니다." })
  if (layout.overflow) issues.push({ kind: "overflow", pageId, blockId: id, message: `텍스트 높이 ${Math.ceil(layout.requiredHeight)}px가 영역 ${frame.height}px를 초과합니다.` })
  return { id, text, lines: layout.lines, frame, style }
}

function selectedProject(project: NewsletterProject, revision: number): NewsletterProject["revisionHistory"][number] {
  const source = project.revisionHistory.find((entry) => entry.revision === revision)
  if (source === undefined) throw new RenderRevisionNotFoundError("project", revision)
  return source
}

function selectedDesign(design: NewsletterDesignState, revision: number): DesignSnapshot {
  const source = design.revisionHistory.find((entry) => entry.revision === revision)
  if (source === undefined) throw new RenderRevisionNotFoundError("design", revision)
  return source.snapshot
}

function verifyAssets(snapshot: DesignSnapshot): void {
  const assets = new Map(snapshot.assetManifest.map((asset) => [asset.id, asset]))
  for (const card of snapshot.cardLayouts) {
    if (card.image.assetId === undefined) continue
    const asset = assets.get(card.image.assetId)
    if (asset?.approvalStatus !== "approved" || asset.localReference === undefined) throw new RenderAssetNotApprovedError(card.image.assetId)
  }
  for (const module of snapshot.a4Layout.modules) {
    if (module.image.assetId === undefined) continue
    const asset = assets.get(module.image.assetId)
    if (asset?.approvalStatus !== "approved" || asset.localReference === undefined) throw new RenderAssetNotApprovedError(module.image.assetId)
  }
}

export function compileRenderDocument(input: CompileInput): RenderDocument {
  const project = parseNewsletterProject(input.project)
  const design = parseNewsletterDesignState(input.design)
  const projectRevision = selectedProject(project, input.projectRevision)
  const designSnapshot = selectedDesign(design, input.designRevision)
  if (project.projectId !== design.projectId) throw new RenderContractMismatchError("project id differs from design sidecar")
  if (designSnapshot.canonicalProjectRevision !== input.projectRevision) throw new RenderContractMismatchError("design points to another canonical project revision")
  verifyAssets(designSnapshot)
  const issues: RenderIssue[] = []
  const titleByTopic = new Map(project.topics.map((topic) => [topic.id, topic.title]))
  const effectiveSections = projectRevision.snapshot.sections.map((section) => ({ ...section, text: section.userEdit?.text ?? section.aiGenerated.text }))
  const a4TitleStyle = { fontFamily: "Pretendard", fontSize: 72, fontWeight: 800, lineHeight: 1.2, color: "#183b4e", align: "center" } as const
  const a4ModuleTitleStyle = { fontFamily: "Pretendard", fontSize: 30, fontWeight: 800, lineHeight: 1.25, color: "#183b4e", align: "left" } as const
  const a4BodyStyle = { fontFamily: "Pretendard", fontSize: 21, fontWeight: 500, lineHeight: 1.45, color: "#29434e", align: "left" } as const
  const a4MetaStyle = { fontFamily: "Pretendard", fontSize: 22, fontWeight: 600, lineHeight: 1.3, color: "#50656f", align: "center" } as const
  const a4Modules = effectiveSections.map((section, index) => {
    const module = designSnapshot.a4Layout.modules[index]
    if (module === undefined) throw new RenderContractMismatchError(`A4 module ${index + 1} is missing`)
    const titleFrame = { ...module.frame, height: 60 }
    const bodyFrame = { x: module.frame.x, y: module.frame.y + 72, width: module.frame.width, height: module.frame.height - 72 }
    return {
      topicId: section.topicId,
      sectionId: section.id,
      title: block(`a4-title-${section.id}`, "a4-page", titleByTopic.get(section.topicId) ?? "", titleFrame, a4ModuleTitleStyle, issues, input.measureText),
      body: block(`a4-body-${section.id}`, "a4-page", section.text, bodyFrame, a4BodyStyle, issues, input.measureText),
      image: module.image,
    }
  })
  const cards = designSnapshot.cardLayouts.map((layout, index) => {
    const section = index === 0 ? undefined : effectiveSections[index - 1]
    const title = index === 0 ? project.title : section === undefined ? "" : titleByTopic.get(section.topicId) ?? ""
    const body = index === 0 ? project.topics.map((topic) => topic.title).join(" · ") : section?.text ?? ""
    return {
      pageId: layout.pageId,
      width: 1200,
      height: 1200,
      background: layout.background,
      title: block(`${layout.pageId}-title`, layout.pageId, title, layout.titleFrame, layout.titleStyle, issues, input.measureText),
      body: block(`${layout.pageId}-body`, layout.pageId, body, layout.bodyFrame, layout.bodyStyle, issues, input.measureText),
      image: layout.image,
    }
  })
  const footerStyle = { fontFamily: "Pretendard", fontSize: 18, fontWeight: 500, lineHeight: 1.4, color: "#50656f", align: "center" } as const
  return {
    projectId: project.projectId,
    projectRevision: input.projectRevision,
    designRevision: input.designRevision,
    a4: {
      pageId: "a4-page",
      width: 1240,
      height: 1754,
      exportWidth: 2480,
      exportHeight: 3508,
      safeMargin: designSnapshot.a4Layout.safeMargin,
      background: designSnapshot.a4Layout.background,
      title: block("a4-main-title", "a4-page", project.title, designSnapshot.a4Layout.headerFrame, a4TitleStyle, issues, input.measureText),
      publicationMeta: block("a4-publication-meta", "a4-page", `${designSnapshot.publicationMeta.issueLabel} · ${designSnapshot.publicationMeta.schoolName}`, { ...designSnapshot.a4Layout.headerFrame, y: designSnapshot.a4Layout.headerFrame.y + 125, height: 50 }, a4MetaStyle, issues, input.measureText),
      modules: a4Modules,
      footer: block("a4-footer", "a4-page", "학교 보건소식 · 내용과 출처를 최종 확인해 주세요.", designSnapshot.a4Layout.footerFrame, footerStyle, issues, input.measureText),
    },
    cards,
    issues,
  }
}
