// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { NewsletterQaApp } from "./NewsletterQaApp"

afterEach(cleanup)

describe("Newsletter NS-3A QA surface", () => {
  it("shows A4 and all seven selectable card previews", async () => {
    // Given
    render(<NewsletterQaApp />)
    await screen.findByRole("img", { name: "A4 보건소식지 미리보기" })

    // When
    fireEvent.click(screen.getByRole("button", { name: "카드뉴스 7장" }))

    // Then
    expect(screen.getAllByRole("button", { name: /표지|번/ })).toHaveLength(7)
    expect(screen.getByRole("img", { name: "card-cover 미리보기" })).toBeTruthy()
  })

  it("increments the design revision without changing project copy", async () => {
    // Given
    render(<NewsletterQaApp />)
    await screen.findByRole("img", { name: "A4 보건소식지 미리보기" })
    fireEvent.click(screen.getByRole("button", { name: "카드뉴스 7장" }))

    // When
    fireEvent.change(screen.getByLabelText("제목 글자 크기"), { target: { value: "82" } })

    // Then
    await waitFor(() => expect(screen.getByText("2", { selector: ".revision-chip strong" })).toBeTruthy())
    expect(screen.getByText("10월 학교 보건소식")).toBeTruthy()
  })
})
