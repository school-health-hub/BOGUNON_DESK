import { parseNewsletterProject, type NewsletterProject } from "../schema"
import { structureCanonicalText } from "./contentStructure"
import { parseNewsletterDesignState, type CardDesignLayoutV2, type DesignSnapshot, type DesignSnapshotV2, type NewsletterDesignState, type TextStyle } from "./designSchema"
import { validateNewsletterDocument } from "./renderScene"
import { layoutText, type TextMeasurer } from "./typography"

export class RenderRevisionNotFoundError extends Error {
  readonly name = "RenderRevisionNotFoundError"
  constructor(readonly kind: "project" | "design", readonly revision: number) { super(`${kind} revision not found: ${revision}`) }
}
export class RenderContractMismatchError extends Error {
  readonly name = "RenderContractMismatchError"
  constructor(readonly reason: string) { super(`render contract mismatch: ${reason}`) }
}
export class RenderAssetNotApprovedError extends Error {
  readonly name = "RenderAssetNotApprovedError"
  constructor(readonly assetId: string) { super(`render asset is not approved: ${assetId}`) }
}

export type TextProvenance =
  | { readonly kind: "project-title" }
  | { readonly kind: "topic-title"; readonly topicId: string }
  | { readonly kind: "canonical-section"; readonly sectionId: string; readonly sourceText: string }
  | { readonly kind: "publication-meta" }
  | { readonly kind: "template-static"; readonly templateVersion: number }

export type Frame = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export type RenderTextBlock = { readonly id: string; readonly text: string; readonly lines: readonly string[]; readonly frame: Frame; readonly style: TextStyle; readonly provenance: TextProvenance }
export type RenderIssue = { readonly kind: "overflow" | "missing-text" | "orphan-character" | "orphan-particle" | "layout-collision" | "clip-bounds"; readonly pageId: string; readonly blockId: string; readonly message: string }
export type RenderImage = { readonly slotId: string; readonly assetId?: string; readonly frame: Frame; readonly fit: "contain" | "cover" }
export type RenderPage = {
  readonly pageId: string; readonly width: number; readonly height: number; readonly background: string; readonly templateVersion: number;
  readonly title: RenderTextBlock; readonly body: RenderTextBlock; readonly badge?: RenderTextBlock; readonly lead?: RenderTextBlock; readonly closing?: RenderTextBlock;
  readonly topicOverview?: readonly RenderTextBlock[];
  readonly image: RenderImage; readonly mascot?: RenderImage; readonly seasonalDecoration?: RenderImage; readonly accent?: string; readonly listMarkerStyle?: "source" | "number" | "dot" | "check"; readonly structured: boolean
}
export type RenderModule = {
  readonly moduleId: string; readonly moduleFrame: Frame; readonly topicId: string; readonly sectionId: string; readonly number?: RenderTextBlock; readonly title: RenderTextBlock;
  readonly body: RenderTextBlock; readonly lead?: RenderTextBlock; readonly closing?: RenderTextBlock; readonly image: RenderImage;
  readonly accent?: string; readonly listMarkerStyle?: "source" | "number" | "dot" | "check"; readonly structured: boolean
}
export type RenderDocument = {
  readonly projectId: string; readonly projectRevision: number; readonly designRevision: number; readonly templateVersion: number;
  readonly a4: { readonly pageId: "a4-page"; readonly width: 1240; readonly height: 1754; readonly exportWidth: 2480; readonly exportHeight: 3508; readonly safeMargin: 59; readonly background: string; readonly templateVersion: number; readonly title: RenderTextBlock; readonly publicationMeta: RenderTextBlock; readonly modules: readonly RenderModule[]; readonly mascot?: RenderImage; readonly seasonalDecoration?: RenderImage; readonly utility?: RenderTextBlock; readonly closing?: RenderTextBlock; readonly footer: RenderTextBlock }
  readonly cards: readonly RenderPage[]; readonly issues: readonly RenderIssue[]
}
type CompileInput = { readonly project: NewsletterProject; readonly projectRevision: number; readonly design: NewsletterDesignState; readonly designRevision: number; readonly measureText?: TextMeasurer }

function block(id: string, pageId: string, text: string, frame: Frame, style: TextStyle, provenance: TextProvenance, issues: RenderIssue[], measureText?: TextMeasurer, required = true): RenderTextBlock {
  const layout = layoutText(text, style, frame, measureText)
  if (required && text.trim().length === 0) issues.push({ kind: "missing-text", pageId, blockId: id, message: "필수 텍스트가 비어 있습니다." })
  if (text.length > 0 && layout.overflow) issues.push({ kind: "overflow", pageId, blockId: id, message: `텍스트 높이 ${Math.ceil(layout.requiredHeight)}px가 영역 ${frame.height}px를 초과합니다.` })
  for (const kind of layout.issues) issues.push({ kind, pageId, blockId: id, message: kind === "orphan-character" ? "한 글자 고아 줄이 발생했습니다." : "짧은 조사가 단독 줄에 배치되었습니다." })
  return { id, text, lines: layout.lines, frame, style, provenance }
}
function projectRevision(project: NewsletterProject, revision: number): NewsletterProject["revisionHistory"][number] {
  const source = project.revisionHistory.find((entry) => entry.revision === revision)
  if (source === undefined) throw new RenderRevisionNotFoundError("project", revision)
  return source
}
function designRevision(design: NewsletterDesignState, revision: number): DesignSnapshot {
  const source = design.revisionHistory.find((entry) => entry.revision === revision)
  if (source === undefined) throw new RenderRevisionNotFoundError("design", revision)
  return source.snapshot
}
function isV2(snapshot: DesignSnapshot): snapshot is DesignSnapshotV2 { return "designSchemaVersion" in snapshot && snapshot.designSchemaVersion === 2 }
function isV2Module(module: DesignSnapshot["a4Layout"]["modules"][number]): module is DesignSnapshotV2["a4Layout"]["modules"][number] { return "titleFrame" in module }
function isV2Card(layout: DesignSnapshot["cardLayouts"][number]): layout is CardDesignLayoutV2 { return "leadFrame" in layout }
const LIST_PREFIX = /^\s*(?:[-*•‣▪◦]|\d+[.)])\s+/u
function actionText(actions: readonly string[], style: CardDesignLayoutV2["listMarkerStyle"]): string {
  if (style === "source") return actions.join("\n")
  return actions.map((action, index) => {
    const source = action.replace(LIST_PREFIX, "")
    const marker = style === "number" ? `${index + 1}.` : style === "check" ? "✓" : "•"
    return `${marker} ${source}`
  }).join("\n")
}
function expandedBodyFrame(leadFrame: Frame, actionFrame: Frame, hasLead: boolean): Frame {
  if (hasLead) return actionFrame
  return { ...actionFrame, y: leadFrame.y, height: actionFrame.y + actionFrame.height - leadFrame.y }
}
function verifyAssets(snapshot: DesignSnapshot): void {
  const assets = new Map(snapshot.assetManifest.map((asset) => [asset.id, asset]))
  const brandImages = isV2(snapshot) ? [
    ...(snapshot.a4Layout.brand === undefined ? [] : [snapshot.a4Layout.brand.mascot, snapshot.a4Layout.brand.seasonalDecoration]),
    ...snapshot.cardLayouts.flatMap((card) => card.brand === undefined ? [] : [card.brand.mascot, ...(card.brand.seasonalDecoration === undefined ? [] : [card.brand.seasonalDecoration])]),
  ] : []
  for (const image of [...snapshot.cardLayouts.map((card) => card.image), ...snapshot.a4Layout.modules.map((module) => module.image), ...brandImages]) {
    if (image.assetId === undefined) continue
    const asset = assets.get(image.assetId)
    const registry = asset?.registry
    const registryApproved = !isV2(snapshot) || (registry?.classification !== "OFFICIAL_REFERENCE" && registry?.purpose !== "reference" && registry?.usageScope === "newsletter-output")
    if (asset?.approvalStatus !== "approved" || asset.localReference !== `asset:${asset.sha256}` || !registryApproved) throw new RenderAssetNotApprovedError(image.assetId)
  }
}

export function compileRenderDocument(input: CompileInput): RenderDocument {
  const project = parseNewsletterProject(input.project)
  const design = parseNewsletterDesignState(input.design)
  const selectedProject = projectRevision(project, input.projectRevision)
  const snapshot = designRevision(design, input.designRevision)
  if (project.projectId !== design.projectId) throw new RenderContractMismatchError("project id differs from design sidecar")
  if (snapshot.canonicalProjectRevision !== input.projectRevision) throw new RenderContractMismatchError("design points to another canonical project revision")
  verifyAssets(snapshot)
  const issues: RenderIssue[] = []
  const titles = new Map(project.topics.map((topic) => [topic.id, topic.title]))
  const sections = selectedProject.snapshot.sections.map((section) => ({ ...section, text: section.userEdit?.text ?? section.aiGenerated.text }))
  const titleStyle = { fontFamily: "Pretendard", fontSize: 72, fontWeight: 800, lineHeight: 1.2, color: "#183b4e", align: "center" } as const
  const moduleTitleStyle = { fontFamily: "Pretendard", fontSize: 30, fontWeight: 800, lineHeight: 1.25, color: "#183b4e", align: "left" } as const
  const bodyStyle = { fontFamily: "Pretendard", fontSize: 21, fontWeight: 500, lineHeight: 1.45, color: "#29434e", align: "left" } as const
  const metaStyle = { fontFamily: "Pretendard", fontSize: 22, fontWeight: 600, lineHeight: 1.3, color: "#50656f", align: "center" } as const
  const numberStyle = { fontFamily: "Pretendard", fontSize: 24, fontWeight: 800, lineHeight: 1.2, color: "#ffffff", align: "center" } as const
  const a4Modules = sections.map((section, index): RenderModule => {
    const module = snapshot.a4Layout.modules[index]
    if (module === undefined) throw new RenderContractMismatchError(`A4 module ${index + 1} is missing`)
    const structured = isV2Module(module)
    const content = structureCanonicalText(section.text)
    const titleFrame = structured ? module.titleFrame : { ...module.frame, height: 60 }
    const leadText = content.kind === "list" ? content.lead ?? "" : ""
    const bodyFrame = structured ? expandedBodyFrame(module.leadFrame, module.actionListFrame, leadText.length > 0) : { x: module.frame.x, y: module.frame.y + 72, width: module.frame.width, height: module.frame.height - 72 }
    const bodyText = content.kind === "list" ? actionText(content.actions, structured ? module.listMarkerStyle : "source") : content.body
    const provenance = { kind: "canonical-section", sectionId: section.id, sourceText: section.text } as const
    return {
      moduleId: module.moduleId, moduleFrame: module.frame, topicId: section.topicId, sectionId: section.id, structured,
      ...(structured ? { number: block(`a4-number-${section.id}`, "a4-page", String(index + 1).padStart(2, "0"), { x: module.frame.x + 12, y: module.frame.y + 12, width: 40, height: 36 }, numberStyle, { kind: "template-static", templateVersion: snapshot.templateVersion }, issues, input.measureText) } : {}),
      title: block(`a4-title-${section.id}`, "a4-page", titles.get(section.topicId) ?? "", titleFrame, moduleTitleStyle, { kind: "topic-title", topicId: section.topicId }, issues, input.measureText),
      ...(structured && leadText.length > 0 ? { lead: block(`a4-lead-${section.id}`, "a4-page", leadText, module.leadFrame, bodyStyle, provenance, issues, input.measureText, false) } : {}),
      body: block(`a4-body-${section.id}`, "a4-page", bodyText, bodyFrame, bodyStyle, provenance, issues, input.measureText),
      ...(structured ? { closing: block(`a4-closing-${section.id}`, "a4-page", "", module.closingFrame, bodyStyle, provenance, issues, input.measureText, false), accent: module.accent, listMarkerStyle: module.listMarkerStyle } : {}),
      image: module.image,
    }
  })
  const cards = snapshot.cardLayouts.map((layout, index): RenderPage => {
    const section = index === 0 ? undefined : sections[index - 1]
    const source = section === undefined ? project.topics.map((topic) => topic.title).join("\n") : section.text
    const content = structureCanonicalText(source)
    const structured = isV2Card(layout)
    const leadText = content.kind === "list" ? content.lead ?? "" : ""
    const bodyText = content.kind === "list" ? actionText(content.actions, structured ? layout.listMarkerStyle : "source") : content.body
    const provenance: TextProvenance = section === undefined ? { kind: "project-title" } : { kind: "canonical-section", sectionId: section.id, sourceText: section.text }
    const title = index === 0 ? project.title : section === undefined ? "" : titles.get(section.topicId) ?? ""
    const bodyFrame = structured ? expandedBodyFrame(layout.leadFrame, layout.actionListFrame, leadText.length > 0) : layout.bodyFrame
    const badgeStyle = { ...layout.bodyStyle, fontSize: Math.min(20, layout.bodyStyle.fontSize), fontWeight: 700, lineHeight: 1.2, color: structured ? layout.accent : layout.titleStyle.color, align: "left" as const }
    const badgeFrame = { x: 88, y: 72, width: 420, height: 36 }
    const previewCount = structured ? layout.brand?.previewTopicCount ?? 6 : 6
    const topicOverview = index === 0 && structured ? project.topics.slice(0, previewCount).map((topic, topicIndex) => {
      const columns = previewCount === 4 ? 4 : 2
      const column = topicIndex % columns
      const row = Math.floor(topicIndex / columns)
      const gap = 12
      const tileWidth = (layout.actionListFrame.width - gap * (columns - 1)) / columns
      const tileHeight = previewCount === 4 ? layout.actionListFrame.height : 94
      const tile = { x: layout.actionListFrame.x + column * (tileWidth + gap), y: layout.actionListFrame.y + row * 122, width: tileWidth, height: tileHeight }
      const frame = { x: tile.x + 16, y: tile.y + 14, width: tile.width - 32, height: tile.height - 28 }
      return block(`${layout.pageId}-topic-${topic.id}`, layout.pageId, topic.title, frame, { ...layout.bodyStyle, fontSize: 25, fontWeight: 700, lineHeight: 1.3, color: layout.titleStyle.color, align: "left" }, { kind: "topic-title", topicId: topic.id }, issues, input.measureText)
    }) : undefined
    return {
      pageId: layout.pageId, width: 1200, height: 1200, background: layout.background, templateVersion: snapshot.templateVersion, structured,
      title: block(`${layout.pageId}-title`, layout.pageId, title, layout.titleFrame, layout.titleStyle, index === 0 ? { kind: "project-title" } : { kind: "topic-title", topicId: section?.topicId ?? "missing" }, issues, input.measureText),
      ...(structured ? { badge: block(`${layout.pageId}-badge`, layout.pageId, snapshot.publicationMeta.issueLabel, badgeFrame, badgeStyle, { kind: "publication-meta" }, issues, input.measureText, false) } : {}),
      ...(structured && leadText.length > 0 ? { lead: block(`${layout.pageId}-lead`, layout.pageId, leadText, layout.leadFrame, layout.bodyStyle, provenance, issues, input.measureText, false) } : {}),
      body: block(`${layout.pageId}-body`, layout.pageId, bodyText, bodyFrame, layout.bodyStyle, provenance, issues, input.measureText),
      ...(topicOverview === undefined ? {} : { topicOverview }),
      ...(structured ? { closing: block(`${layout.pageId}-closing`, layout.pageId, "", layout.closingFrame, layout.bodyStyle, provenance, issues, input.measureText, false), accent: layout.accent, listMarkerStyle: layout.listMarkerStyle } : {}),
      image: layout.image,
      ...(structured && layout.brand !== undefined ? { mascot: layout.brand.mascot, ...(layout.brand.seasonalDecoration === undefined ? {} : { seasonalDecoration: layout.brand.seasonalDecoration }) } : {}),
    }
  })
  const footerStyle = { fontFamily: "Pretendard", fontSize: 18, fontWeight: 500, lineHeight: 1.4, color: "#50656f", align: "center" } as const
  const a4TitleFrame = isV2(snapshot) ? snapshot.a4Layout.titleFrame : snapshot.a4Layout.headerFrame
  const metaFrame = isV2(snapshot) ? snapshot.a4Layout.publicationMetaFrame : { ...snapshot.a4Layout.headerFrame, y: snapshot.a4Layout.headerFrame.y + 125, height: 50 }
  const base: RenderDocument = {
    projectId: project.projectId, projectRevision: input.projectRevision, designRevision: input.designRevision, templateVersion: snapshot.templateVersion,
    a4: { pageId: "a4-page", width: 1240, height: 1754, exportWidth: 2480, exportHeight: 3508, safeMargin: snapshot.a4Layout.safeMargin, background: snapshot.a4Layout.background, templateVersion: snapshot.templateVersion,
      title: block("a4-main-title", "a4-page", project.title, a4TitleFrame, titleStyle, { kind: "project-title" }, issues, input.measureText),
      publicationMeta: block("a4-publication-meta", "a4-page", `${snapshot.publicationMeta.issueLabel} · ${snapshot.publicationMeta.schoolName}`, metaFrame, metaStyle, { kind: "publication-meta" }, issues, input.measureText),
      modules: a4Modules,
      ...(isV2(snapshot) && snapshot.a4Layout.brand !== undefined ? {
        mascot: snapshot.a4Layout.brand.mascot,
        seasonalDecoration: snapshot.a4Layout.brand.seasonalDecoration,
        utility: block("a4-utility", "a4-page", "보건실 안내", snapshot.a4Layout.brand.utilityFrame, { ...footerStyle, fontWeight: 700, color: "#176b45" }, { kind: "template-static", templateVersion: snapshot.templateVersion }, issues, input.measureText, false),
        closing: block("a4-closing", "a4-page", "건강 안내는 학교 원고와 일정을 최종 확인해 주세요.", snapshot.a4Layout.brand.closingFrame, footerStyle, { kind: "template-static", templateVersion: snapshot.templateVersion }, issues, input.measureText, false),
      } : {}),
      footer: block("a4-footer", "a4-page", "학교 보건소식 · 내용과 출처를 최종 확인해 주세요.", snapshot.a4Layout.footerFrame, footerStyle, { kind: "template-static", templateVersion: snapshot.templateVersion }, issues, input.measureText),
    }, cards, issues,
  }
  const layoutIssues = validateNewsletterDocument(base).map((issue): RenderIssue => ({ kind: issue.kind, pageId: issue.pageId, blockId: issue.layerId, message: issue.message }))
  return { ...base, issues: [...issues, ...layoutIssues] }
}
