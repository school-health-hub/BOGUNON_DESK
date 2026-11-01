// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { NewsletterProject } from "../schema"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState, parseNewsletterDesignStateV2, type NewsletterDesignState } from "./designSchema"
import { upgradeNewsletterDesignStateV2 } from "./designState"
import { NewsletterDesignEditor } from "./NewsletterDesignEditor"
afterEach(cleanup)
const now = "2026-10-30T00:00:00.000Z"
async function fixture() {
  const project = await createNewsletterProject({ projectId: "editorial-ui", title: "11월 보건소식지", now })
  const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now)
  return { project, design }
}
describe("editorial layout editing", () => {
  it("creates a layout revision only after selecting a new card layout and can restore it", async () => {
    // Given
    const { project, design } = await fixture()
    render(<NewsletterDesignEditor project={project} initialDesign={design} />)
    fireEvent.click(screen.getByRole("button", { name: "카드뉴스 7장" }))
    // When
    fireEvent.change(screen.getByLabelText("편집형 레이아웃"), { target: { value: "A" } })
    // Then
    await waitFor(() => expect(screen.getByLabelText("표지 학생 구성")).toBeTruthy())
    expect(design.designRevision).toBe(2)
    fireEvent.change(screen.getByLabelText("Revision 복원"), { target: { value: "2" } })
    expect(screen.getByLabelText("편집형 레이아웃")).toHaveProperty("value", "legacy")
  })
  it("explains the missing four actions before allowing an education grid", async () => {
    // Given
    const { project, design } = await fixture()
    render(<NewsletterDesignEditor project={project} initialDesign={design} />)
    fireEvent.click(screen.getByRole("button", { name: "카드뉴스 7장" }))
    // When
    fireEvent.click(screen.getByRole("button", { name: "1" }))
    // Then
    expect(screen.getByText(/실천 항목 4개가 필요/)).toBeTruthy()
    expect(screen.getByRole("option", { name: /TYPE B/ })).toHaveProperty("disabled", true)
  })
  it("preserves edited canonical copy and the selected layout when a host reloads saved state", async () => {
    // Given
    const { project, design } = await fixture()
    let saved: { readonly project: NewsletterProject; readonly design: NewsletterDesignState } | undefined
    const view = render(<NewsletterDesignEditor project={project} initialDesign={design} onChange={(value) => { saved = value }} />)
    const copy = "함께 실천해요\n1. 손 씻기\n2. 물 마시기\n3. 따뜻하게 입기\n4. 쉬기"
    // When
    fireEvent.change(screen.getByLabelText("부제·실천 수칙 원고"), { target: { value: copy } })
    fireEvent.change(screen.getByLabelText("원고 제목"), { target: { value: "내가 정한 주제" } })
    fireEvent.click(screen.getByRole("button", { name: "원고 반영" }))
    await waitFor(() => expect(saved?.project.projectRevision).toBe(2))
    fireEvent.click(screen.getByRole("button", { name: "카드뉴스 7장" }))
    fireEvent.click(screen.getByRole("button", { name: "1" }))
    fireEvent.change(screen.getByLabelText("편집형 레이아웃"), { target: { value: "B" } })
    await waitFor(() => expect(saved?.design.designSchemaVersion === 2 ? saved.design.cardLayouts[1]?.editorial?.layoutType : undefined).toBe("B"))
    // Then
    const persisted = saved
    if (persisted === undefined) throw new Error("Host did not receive edited state")
    expect(persisted.project.canonicalCopy.sections[0]?.userEdit?.text).toBe(copy)
    expect(persisted.project.topics[0]?.title).toBe("내가 정한 주제")
    expect(persisted.project.revisionHistory[0]?.snapshot.sections[0]?.userEdit).toBeUndefined()
    view.unmount()
    render(<NewsletterDesignEditor project={persisted.project} initialDesign={persisted.design} />)
    fireEvent.click(screen.getByRole("button", { name: "카드뉴스 7장" }))
    fireEvent.click(screen.getByRole("button", { name: "1" }))
    expect(screen.getByLabelText("편집형 레이아웃")).toHaveProperty("value", "B")
    expect(screen.getByLabelText("부제·실천 수칙 원고")).toHaveProperty("value", copy)
  })
  it("resolves registered external images through the host resolver and clears them when cover composition changes", async () => {
    // Given
    const { project, design } = await fixture()
    const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII="), (value) => value.charCodeAt(0))
    const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.buffer))].map((value) => value.toString(16).padStart(2, "0")).join("")
    const asset = { id: "external-illustration", sha256, mediaType: "image/png", approvalStatus: "approved", originalName: "명시적으로 선택한 대표 장면", localReference: `asset:${sha256}`, registry: { classification: "USER_CREATED", purpose: "illustration", usageScope: "newsletter-output" } }
    const cards = design.cardLayouts.map((card, index) => index === 0 ? { ...card, image: { ...card.image, assetId: asset.id } } : card)
    const prepared = parseNewsletterDesignStateV2({ ...design, cardLayouts: cards, assetManifest: [asset], revisionHistory: design.revisionHistory.map((entry, index) => index === design.revisionHistory.length - 1 ? { ...entry, snapshot: { ...entry.snapshot, cardLayouts: cards, assetManifest: [asset] } } : entry) })
    const resolve = vi.fn(async () => new Uint8Array(bytes))
    let saved: NewsletterDesignState | undefined
    render(<NewsletterDesignEditor project={project} initialDesign={prepared} assetResolver={{ resolve }} onChange={(value) => { saved = value.design }} />)
    await waitFor(() => expect(resolve).toHaveBeenCalledWith(asset.localReference))
    fireEvent.click(screen.getByRole("button", { name: "카드뉴스 7장" }))
    fireEvent.change(screen.getByLabelText("편집형 레이아웃"), { target: { value: "A" } })
    // When
    fireEvent.change(screen.getByLabelText("표지 학생 구성"), { target: { value: "female" } })
    // Then
    await waitFor(() => expect(saved?.cardLayouts[0]?.image.assetId).toBeUndefined())
    expect(saved?.designSchemaVersion === 2 ? saved.cardLayouts[0]?.editorial?.studentComposition : undefined).toBe("female")
    expect(screen.getByText(/대표 장면 선택이 필요합니다/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText("표지 대표 장면"), { target: { value: asset.id } })
    await waitFor(() => expect(saved?.cardLayouts[0]?.image.assetId).toBe(asset.id))
  })
  it("exposes the existing four output formats with an explicit approval gate", async () => {
    // Given
    const { project, design } = await fixture()
    render(<NewsletterDesignEditor project={project} initialDesign={design} />)
    // When
    const output = screen.getByLabelText("출력 형식")
    // Then
    expect(output.querySelectorAll("option")).toHaveLength(4)
    expect(screen.getByRole("button", { name: "출력 폴더 선택·저장" })).toHaveProperty("disabled", true)
  })

  it("keeps BEFORE pinned when the host echoes a changed design through its initial props", async () => {
    // Given
    const { project, design } = await fixture()
    let saved: NewsletterDesignState | undefined
    const onChange = (value: { readonly design: NewsletterDesignState }): void => { saved = value.design }
    const view = render(<NewsletterDesignEditor project={project} initialDesign={design} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: "카드뉴스 7장" }))
    fireEvent.click(screen.getByRole("button", { name: "변경 전후 비교" }))
    await waitFor(() => expect(view.container.querySelectorAll(".preview-grid article svg")).toHaveLength(2))
    const beforeHash = view.container.querySelector(".preview-grid article svg")?.getAttribute("data-scene-hash")
    // When
    fireEvent.change(screen.getByLabelText("주제 강조색"), { target: { value: "#aa5566" } })
    await waitFor(() => expect(saved?.designRevision).toBe(3))
    if (saved === undefined) throw new Error("Host did not receive the design revision")
    view.rerender(<NewsletterDesignEditor project={project} initialDesign={saved} onChange={onChange} />)
    // Then
    await waitFor(() => expect(view.container.querySelectorAll(".preview-grid article svg")).toHaveLength(2))
    const previews = view.container.querySelectorAll(".preview-grid article svg")
    expect(previews[0]?.getAttribute("data-scene-hash")).toBe(beforeHash)
    expect(previews[1]?.getAttribute("data-scene-hash")).not.toBe(beforeHash)
  })

  it("preserves user A4 footer copy in design revisions and host reloads without changing canonical text", async () => {
    // Given
    const { project, design } = await fixture()
    let saved: NewsletterDesignState | undefined
    const view = render(<NewsletterDesignEditor project={project} initialDesign={design} onChange={(value) => { saved = value.design }} />)
    // When
    fireEvent.change(screen.getByLabelText("A4 보건실 안내 문구"), { target: { value: "몸이 불편하면 먼저 알려주세요." } })
    fireEvent.change(screen.getByLabelText("A4 마무리 문구"), { target: { value: "건강한 11월을 응원합니다." } })
    fireEvent.change(screen.getByLabelText("A4 출처 표기"), { target: { value: "건강정보 참고: 사용자 확인 자료" } })
    // Then
    await waitFor(() => expect(saved?.designRevision).toBe(5))
    const persisted = saved
    if (persisted === undefined) throw new Error("Host did not receive A4 footer revisions")
    expect(persisted.canonicalProjectRevision).toBe(design.canonicalProjectRevision)
    expect(project.projectRevision).toBe(1)
    expect(project.canonicalCopy).toEqual(project.revisionHistory[0]?.snapshot)
    view.unmount()
    render(<NewsletterDesignEditor project={project} initialDesign={persisted} />)
    expect(screen.getByLabelText("A4 보건실 안내 문구")).toHaveProperty("value", "몸이 불편하면 먼저 알려주세요.")
    expect(screen.getByLabelText("A4 마무리 문구")).toHaveProperty("value", "건강한 11월을 응원합니다.")
    expect(screen.getByLabelText("A4 출처 표기")).toHaveProperty("value", "건강정보 참고: 사용자 확인 자료")
    fireEvent.change(screen.getByLabelText("Revision 복원"), { target: { value: "2" } })
    expect(screen.getByLabelText("A4 출처 표기")).toHaveProperty("value", "")
  })
})
