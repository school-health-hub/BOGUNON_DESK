import { describe, expect, it } from "vitest"
import { editorialActionIcon } from "./editorialIcons"
import { layoutText } from "./typography"
import type { TextStyle } from "./designSchema"

const style: TextStyle = { fontFamily: "Pretendard", fontSize: 20, fontWeight: 600, lineHeight: 1.3, color: "#0D254D", align: "left" }
describe("editorial visual regressions", () => {
  it("uses the scarf prop for hands-and-neck warmth rather than handwashing soap", () => {
    // Given
    const frame = { x: 0, y: 0, width: 100, height: 100 }
    // When
    const cold = editorialActionIcon("cold", "장갑·목도리로 손과 목 따뜻하게 하기", frame, "#175D3A")
    const scarf = editorialActionIcon("scarf", "목도리로 보온하기", frame, "#175D3A")
    const soap = editorialActionIcon("soap", "비누로 손 씻기", frame, "#175D3A")
    // Then
    expect(cold.path).toBe(scarf.path)
    expect(cold.path).not.toBe(soap.path)
  })
  it.each([
    ["30초 손 씻기", "손 씻기", 82],
    ["물 마시지 않기", "마시지 않기", 120],
    ["몸에 대지 않기", "대지 않기", 120],
    ["핫팩을 떼어 놓기", "떼어 놓기", 120],
    ["목을 따뜻하게 하기", "따뜻하게 하기", 140],
  ] as const)("keeps the action phrase together in %s", (source, phrase, width) => {
    // Given / When
    const result = layoutText(source, style, { width, height: 200 }, undefined, "newsletter-actions")
    // Then
    expect(result.lines.some(line => line.includes(phrase))).toBe(true)
    expect(result.lines.join(" ")).toBe(source)
    expect(result.overflow).toBe(false)
  })
})
