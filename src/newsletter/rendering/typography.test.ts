import { describe, expect, it } from "vitest"
import { layoutText } from "./typography"

const style = { fontFamily: "Pretendard", fontSize: 20, fontWeight: 500, lineHeight: 1.5, color: "#000000", align: "left" } as const

describe("Korean newsletter typography", () => {
  it("prefers Intl word segmentation and preserves mixed Korean text", () => {
    const text = "응급상황 ABC-123 (보건실 안내)를 확인해요"
    const result = layoutText(text, style, { width: 180, height: 300 })
    expect(result.segmenter).toBe(typeof Reflect.get(Intl, "Segmenter") === "function" ? "intl-word" : "fallback")
    expect(result.lines.join("").replace(/\s/gu, "")).toBe(text.replace(/\s/gu, ""))
    expect(result.lines.every((line) => !line.endsWith("…"))).toBe(true)
  })

  it("flags a one-character orphan without deleting it", () => {
    const result = layoutText("건강 가", style, { width: 20, height: 300 }, (text) => [...text].length * 20)
    expect(result.lines.join("").replace(/\s/gu, "")).toBe("건강가")
    expect(result.issues).toContain("orphan-character")
  })
})
