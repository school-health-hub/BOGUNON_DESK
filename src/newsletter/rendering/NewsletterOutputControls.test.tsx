// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState } from "./designSchema"
import { NewsletterOutputControls } from "./NewsletterOutputControls"
const adapters = vi.hoisted(() => ({ generate: vi.fn(), pick: vi.fn(), save: vi.fn() }))
vi.mock("../output/outputEngine", () => ({ generateNewsletterOutputs: adapters.generate }))
vi.mock("../output/storageClient", () => ({ pickNewsletterOutputTarget: adapters.pick, saveNewsletterOutput: adapters.save }))
afterEach(cleanup)
beforeEach(() => { adapters.generate.mockReset(); adapters.pick.mockReset(); adapters.save.mockReset() })
async function fixture() {
  const now = "2026-10-30T00:00:00.000Z"
  const project = await createNewsletterProject({ projectId: "output-ui", title: "11월 보건소식지", now })
  const design = createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now })
  return { project, design }
}
describe("publication output controls", () => {
  it("keeps the publication gate closed for pending approval and never calls a QA bypass", async () => {
    // Given
    const data = await fixture()
    render(<NewsletterOutputControls {...data} ready={false} blockedReason="출력 승인 대기" />)
    // When
    fireEvent.click(screen.getByRole("button", { name: "출력 폴더 선택·저장" }))
    // Then
    expect(screen.getByText(/출력 대기: 출력 승인 대기/)).toBeTruthy()
    expect(adapters.generate).not.toHaveBeenCalled()
    expect(adapters.pick).not.toHaveBeenCalled()
  })
  it("passes each selected format to the existing Native save adapter with no replacement", async () => {
    // Given
    const data = await fixture()
    const target = { token: "target", label: "선택한 폴더" }
    const measureText = vi.fn(() => 10)
    const bundle = { manifest: { projectId: data.project.projectId } }
    adapters.pick.mockResolvedValue(target)
    adapters.generate.mockResolvedValue(bundle)
    adapters.save.mockResolvedValue({ status: "succeeded" })
    render(<NewsletterOutputControls {...data} ready blockedReason="" measureText={measureText} />)
    for (const selection of ["a4-png", "a4-pdf", "card-pngs", "cards-pdf"]) {
      // When
      fireEvent.change(screen.getByLabelText("출력 형식"), { target: { value: selection } })
      fireEvent.click(screen.getByRole("button", { name: "출력 폴더 선택·저장" }))
      // Then
      await waitFor(() => expect(adapters.save).toHaveBeenLastCalledWith(target, bundle, selection, "deny"))
      await screen.findByText("선택한 폴더에 출력물을 저장했습니다.")
    }
    expect(adapters.generate.mock.calls.every(([input]) => input.purpose === undefined && input.measureText === measureText)).toBe(true)
  })
  it("reports an unavailable Native picker before starting expensive rendering", async () => {
    // Given
    const data = await fixture()
    adapters.pick.mockRejectedValue(new Error("Newsletter 출력 저장은 Windows 앱에서 사용할 수 있습니다."))
    render(<NewsletterOutputControls {...data} ready blockedReason="" />)
    // When
    fireEvent.click(screen.getByRole("button", { name: "출력 폴더 선택·저장" }))
    // Then
    expect((await screen.findByRole("alert")).textContent).toContain("Windows 앱")
    expect(adapters.generate).not.toHaveBeenCalled()
    expect(adapters.save).not.toHaveBeenCalled()
  })
})
