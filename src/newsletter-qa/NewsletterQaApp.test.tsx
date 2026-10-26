// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { NewsletterQaApp } from "./NewsletterQaApp"

afterEach(cleanup)

describe("Newsletter NS-3A QA surface", () => {
  async function upgradeToV2(): Promise<void> {
    fireEvent.click(screen.getByRole("button", { name: "V2 디자인 검토" }))
    await screen.findByRole("dialog", { name: "V2 디자인으로 전환할까요?" })
    fireEvent.click(screen.getByRole("button", { name: "V2로 전환" }))
    await waitFor(() => expect(screen.getByText("Design V2")).toBeTruthy())
  }

  it("shows A4 and all seven selectable card previews", async () => {
    // Given
    render(<NewsletterQaApp />)
    await screen.findByRole("img", { name: "A4 보건소식지 미리보기" })
    await upgradeToV2()

    // When
    fireEvent.click(screen.getByRole("button", { name: "카드뉴스 7장" }))

    // Then
    expect(screen.getAllByRole("button", { name: /^(?:표지|[1-6])$/ })).toHaveLength(7)
    expect(screen.getAllByRole("img", { name: "card-cover 미리보기" })).toHaveLength(2)
  })

  it("increments the design revision without changing project copy", async () => {
    // Given
    render(<NewsletterQaApp />)
    await screen.findByRole("img", { name: "A4 보건소식지 미리보기" })
    await upgradeToV2()
    fireEvent.click(screen.getByRole("button", { name: "카드뉴스 7장" }))

    // When
    fireEvent.change(screen.getByLabelText("레이아웃 variant"), { target: { value: "image-focus" } })

    // Then
    await waitFor(() => expect(screen.getByText("3", { selector: ".revision-chip strong" })).toBeTruthy())
    expect(screen.getByText("10월 학교 보건소식")).toBeTruthy()
  })

  it("cancels an explicit V2 upgrade without changing the revision", async () => {
    render(<NewsletterQaApp />)
    await screen.findByRole("img", { name: "A4 보건소식지 미리보기" })
    fireEvent.click(screen.getByRole("button", { name: "V2 디자인 검토" }))
    fireEvent.click(await screen.findByRole("button", { name: "취소" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.getByText("Design V1")).toBeTruthy()
    expect(screen.getByText("1", { selector: ".revision-chip strong" })).toBeTruthy()
  })
})
