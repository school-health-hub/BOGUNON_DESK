// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createNewsletterProject } from "../project"
import { createNewsletterDesignState } from "./designSchema"
import { upgradeNewsletterDesignStateV2 } from "./designState"
import { NewsletterDesignEditor } from "./NewsletterDesignEditor"
import { attachApprovedMascot } from "./bundledMascot"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe("approved mascot editor action", () => {
  it("never advertises output readiness when image verification fails", async () => {
    // Given
    const now = "2026-10-29T00:00:00.000Z"
    const project = await createNewsletterProject({ projectId: "project-1", title: "보건소식", now })
    const design = attachApprovedMascot(upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now), now)
    vi.stubGlobal("fetch", async () => { throw new TypeError("image unavailable") })
    // When
    const view = render(<NewsletterDesignEditor project={project} initialDesign={design} />)
    await screen.findByRole("alert")
    // Then
    expect(view.container.querySelector(".status-pill")?.textContent).toBe("이미지 검증 실패 · 출력 차단")
    expect(screen.queryByText("출력 가능")).toBeNull()
  })
  it("keeps an existing V2 unchanged until the explicit apply action", async () => {
    // Given
    const now = "2026-10-29T00:00:00.000Z"
    const project = await createNewsletterProject({ projectId: "project-1", title: "보건소식", now })
    const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: project.projectId, canonicalProjectRevision: 1, now }), now)
    const view = render(<NewsletterDesignEditor project={project} initialDesign={design} />)
    await screen.findByRole("img", { name: "A4 보건소식지 미리보기" })
    expect(design.assetManifest).toHaveLength(0)
    // When
    fireEvent.click(screen.getByRole("button", { name: "승인 수달쌤 적용" }))
    // Then
    await waitFor(() => expect(view.container.querySelectorAll(".asset-status")[0]?.textContent).toContain("실제 출력 승인 대기"))
    expect(design.designRevision).toBe(2)
    expect(design.assetManifest).toHaveLength(0)
  })
})
