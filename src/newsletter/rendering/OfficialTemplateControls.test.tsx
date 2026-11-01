// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { createNewsletterDesignState, parseNewsletterDesignStateV2 } from "./designSchema"
import { applyEditorialLayout, updateCardLayout, upgradeNewsletterDesignStateV2 } from "./designState"
import { applyOfficialTemplate } from "./officialTemplate"
import { NewsletterEditorialControls } from "./NewsletterEditorialControls"
import { NewsletterDesignControls } from "./NewsletterDesignControls"

afterEach(cleanup)
const now = "2026-11-01T07:00:00.000Z"
function plain() { return upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "official-controls", canonicalProjectRevision: 1, now }), now) }
it("exposes assignable illustration sources without inert legacy geometry on a fresh V2 card", () => {
  // Given
  const design = applyOfficialTemplate(plain(), { cardIndices: [1], now })
  // When
  render(<NewsletterEditorialControls design={design} cardIndex={1} actionCount={4} onChange={vi.fn()} />)
  // Then
  expect(screen.getByLabelText("교육 모듈 1 삽화")).toBeTruthy()
  expect(screen.getByLabelText("공식 요소")).toBeTruthy()
  expect(screen.queryByLabelText("주제 메인 삽화")).toBeNull()
  expect(screen.queryByLabelText("월별 계절 장식")).toBeNull()
  expect(screen.queryByLabelText("교육 모듈 1 삽화 크기")).toBeNull()
})
it("keeps source illustration selectors available after applying over a previous composition preset", () => {
  // Given
  const base = applyEditorialLayout(plain(), { cardIndex: 1, layoutType: "B", now })
  const card = base.cardLayouts[1]
  if (card?.editorial === undefined) throw new Error("fixture lacks editorial source bindings")
  const previous = parseNewsletterDesignStateV2(updateCardLayout(base, { cardIndex: 1, now, patch: { editorial: { ...card.editorial, compositionPreset: "september-master" } } }))
  const design = applyOfficialTemplate(previous, { cardIndices: [1], now })
  // When
  render(<NewsletterEditorialControls design={design} cardIndex={1} actionCount={4} onChange={vi.fn()} />)
  // Then
  expect(screen.getAllByLabelText(/교육 모듈 \d 삽화$/u)).toHaveLength(4)
})
it("edits the selected live text element and does not expose the legacy frame editor", () => {
  // Given
  const design = applyOfficialTemplate(plain(), { cardIndices: [1], now })
  const change = vi.fn()
  render(<><NewsletterEditorialControls design={design} cardIndex={1} actionCount={4} onChange={change} /><NewsletterDesignControls design={design} mode="cards" selectedIndex={1} onChange={change} /></>)
  // When
  fireEvent.change(screen.getByLabelText("공식 요소 글자 크기"), { target: { value: "90" } })
  // Then
  const changed = parseNewsletterDesignStateV2(change.mock.calls[0]?.[0])
  expect(changed.cardLayouts[1]?.officialTemplate?.elements.find(element => element.kind === "text" && element.id === "headline")).toMatchObject({ style: { fontSize: 90 } })
  expect(screen.queryByLabelText("프레임 가로")).toBeNull()
})
it("retains the mascot layer and its geometry when the selected image is hidden", () => {
  const design = applyOfficialTemplate(plain(), { cardIndices: [1], now })
  const change = vi.fn()
  render(<NewsletterEditorialControls design={design} cardIndex={1} actionCount={4} onChange={change} />)
  fireEvent.change(screen.getByLabelText("공식 요소"), { target: { value: "mascot" } })
  fireEvent.click(screen.getByLabelText("공식 요소 표시"))
  const changed = parseNewsletterDesignStateV2(change.mock.calls[0]?.[0])
  expect(changed.cardLayouts[1]?.officialTemplate?.elements.find(element => element.id === "mascot")).toMatchObject({ kind: "image", visible: false, binding: "mascot" })
  expect(changed.cardLayouts[1]?.brand).toEqual(design.cardLayouts[1]?.brand)
})
it("edits official closing copy without changing the legacy text shared by A4", () => {
  const design = applyOfficialTemplate(plain(), { cardIndices: [1], now })
  const change = vi.fn()
  render(<NewsletterEditorialControls design={design} cardIndex={1} actionCount={4} onChange={change} />)
  fireEvent.change(screen.getByLabelText("공식 마무리 문구"), { target: { value: "건강한 11월을 응원합니다!" } })
  const changed = parseNewsletterDesignStateV2(change.mock.calls[0]?.[0])
  expect(changed.cardLayouts[1]?.officialTemplate?.closingText).toBe("건강한 11월을 응원합니다!")
  expect(changed.cardLayouts[1]?.editorial?.closing).toEqual(design.cardLayouts[1]?.editorial?.closing)
  expect(screen.queryByLabelText("마무리 문구")).toBeNull()
})
