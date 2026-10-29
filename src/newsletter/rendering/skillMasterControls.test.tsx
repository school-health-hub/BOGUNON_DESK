// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { createNewsletterDesignState } from "./designSchema"
import { upgradeNewsletterDesignStateV2 } from "./designState"
import { NewsletterEditorialControls } from "./NewsletterEditorialControls"

afterEach(cleanup)
it("applies the master through the explicit editor action", () => {
  // Given
  const now = "2026-10-30T00:00:00.000Z"
  const design = upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "master-test", canonicalProjectRevision: 1, now }), now)
  const onChange = vi.fn()
  render(<NewsletterEditorialControls design={design} cardIndex={1} actionCount={4} onChange={onChange} />)
  expect(onChange).not.toHaveBeenCalled()
  // When
  fireEvent.click(screen.getByRole("button", { name: "9월 스킬 기본형 · A4·표지·선택 카드 적용" }))
  // Then
  expect(onChange).toHaveBeenCalledOnce()
  expect(onChange.mock.calls[0]?.[0]?.cardLayouts[1]?.editorial?.compositionPreset).toBe("september-master")
  expect(onChange.mock.calls[0]?.[0]?.cardLayouts.slice(2)).toEqual(design.cardLayouts.slice(2))
})
