// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createNewsletterProject } from "./project"
import { createNewsletterDesignState } from "./rendering/designSchema"
import { NewsletterStudio } from "./NewsletterStudio"
import { serializeStudioDocument, type StudioDocument } from "./studioDocument"

vi.mock("./rendering/NewsletterDesignEditor", () => ({ NewsletterDesignEditor: ({ project, initialDesign, onChange }: { readonly project: StudioDocument["project"]; readonly initialDesign: StudioDocument["design"]; readonly onChange: (value: StudioDocument) => void }) => <section><h2>{project.title}</h2><button onClick={() => onChange({ project: { ...project, title: "수정한 학교 소식" }, design: initialDesign })}>원고 편집</button><span>Design V{initialDesign.designSchemaVersion}</span></section> }))
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false }))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const now = "2026-10-30T00:00:00.000Z"
async function fixture(): Promise<StudioDocument> {
  const project = await createNewsletterProject({ projectId: "host-document", title: "기존 학교 소식", now })
  return { project, design: createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }) }
}
function jsonFile(json: string): File {
  const file = new File([json], "newsletter.json", { type: "application/json" })
  Object.defineProperty(file, "text", { value: async () => json })
  return file
}
function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Expected text")); reader.onerror = reject; reader.readAsText(blob) })
}

describe("product Newsletter host", () => {
  it("opens existing documents, preserves edits in JSON, and reopens them", async () => {
    // Given
    const initial = await fixture()
    const blobs: Blob[] = []
    vi.stubGlobal("URL", { createObjectURL: (blob: Blob) => { blobs.push(blob); return "blob:test" }, revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    render(<NewsletterStudio onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("원고·디자인 JSON 열기"), { target: { files: [jsonFile(serializeStudioDocument(initial))] } })
    await screen.findByRole("heading", { name: initial.project.title })
    // When
    fireEvent.click(screen.getByRole("button", { name: "원고 편집" }))
    fireEvent.click(screen.getByRole("button", { name: "원고·디자인 JSON 저장" }))
    const saved = blobs[0]
    if (saved === undefined) throw new Error("No saved document")
    const json = await blobText(saved)
    fireEvent.change(screen.getByLabelText("원고·디자인 JSON 열기"), { target: { files: [jsonFile(json)] } })
    // Then
    await screen.findByRole("heading", { name: "수정한 학교 소식" })
    expect(JSON.parse(json).design).toEqual(initial.design)
    expect(screen.getByRole("button", { name: "Windows 원고 저장" })).toHaveProperty("disabled", true)
    expect(screen.getByText(/이미지 원본은 포함하지 않습니다/)).toBeTruthy()
  })
  it("keeps the current document when an invalid replacement is selected", async () => {
    // Given
    const initial = await fixture()
    render(<NewsletterStudio onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("원고·디자인 JSON 열기"), { target: { files: [jsonFile(serializeStudioDocument(initial))] } })
    await screen.findByRole("heading", { name: initial.project.title })
    // When
    fireEvent.change(screen.getByLabelText("원고·디자인 JSON 열기"), { target: { files: [jsonFile("invalid JSON")] } })
    // Then
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/JSON|Unexpected/))
    expect(screen.getByRole("heading", { name: initial.project.title })).toBeTruthy()
    const cardLayouts = initial.design.cardLayouts.map((card, index) => index === 0 ? { ...card, image: { ...card.image, assetId: "missing-image" } } : card)
    const invalid = { ...initial.design, cardLayouts, revisionHistory: initial.design.revisionHistory.map(entry => ({ ...entry, snapshot: { ...entry.snapshot, cardLayouts } })) }
    fireEvent.change(screen.getByLabelText("원고·디자인 JSON 열기"), { target: { files: [jsonFile(JSON.stringify({ project: initial.project, design: invalid }))] } })
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/not approved/))
    expect(screen.getByRole("heading", { name: initial.project.title })).toBeTruthy()
    const first = initial.design.revisionHistory[0]
    if (first === undefined) throw new Error("Missing initial revision")
    const historicalOnly = { ...initial.design, designRevision: 2, revisionHistory: [{ ...first, snapshot: { ...first.snapshot, cardLayouts } }, { ...first, revision: 2 }] }
    fireEvent.change(screen.getByLabelText("원고·디자인 JSON 열기"), { target: { files: [jsonFile(JSON.stringify({ project: initial.project, design: historicalOnly }))] } })
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/not approved/))
    expect(screen.getByRole("heading", { name: initial.project.title })).toBeTruthy()
  })
})
