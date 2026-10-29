import type { TextStyle } from "./designSchema"

export type TextBox = { readonly width: number; readonly height: number }
export type TextLayoutIssue = "orphan-character" | "orphan-particle"
export type TextLayout = { readonly lines: readonly string[]; readonly overflow: boolean; readonly requiredHeight: number; readonly issues: readonly TextLayoutIssue[]; readonly segmenter: "intl-word" | "fallback" }
export type TextMeasurer = (text: string, style: TextStyle) => number

const PARTICLES = new Set(["은", "는", "이", "가", "을", "를", "에", "의", "도", "만", "와", "과", "로", "으로", "에서", "에게", "께", "부터", "까지", "보다", "처럼"])
function glyphWidth(character: string, fontSize: number): number {
  if (/\s/u.test(character)) return fontSize * 0.33
  if (/[\u1100-\u11ff\u3130-\u318f\u3400-\u9fff\uac00-\ud7af]/u.test(character)) return fontSize
  if (/[A-Z0-9]/u.test(character)) return fontSize * 0.68
  return fontSize * 0.56
}
export function estimatedTextWidth(text: string, style: TextStyle): number { return [...text].reduce((width, character) => width + glyphWidth(character, style.fontSize), 0) }

type Segments = { readonly values: readonly string[]; readonly implementation: TextLayout["segmenter"] }
function intlSegments(text: string): readonly string[] | undefined {
  const constructor = Reflect.get(Intl, "Segmenter")
  if (typeof constructor !== "function") return undefined
  const instance = Reflect.construct(constructor, ["ko", { granularity: "word" }])
  if (typeof instance !== "object" || instance === null) return undefined
  const segment = Reflect.get(instance, "segment")
  if (typeof segment !== "function") return undefined
  const result = Reflect.apply(segment, instance, [text])
  if (typeof result !== "object" || result === null) return undefined
  const iteratorFactory = Reflect.get(result, Symbol.iterator)
  if (typeof iteratorFactory !== "function") return undefined
  const iterator = Reflect.apply(iteratorFactory, result, [])
  if (typeof iterator !== "object" || iterator === null) return undefined
  const values: string[] = []
  while (true) {
    const next = Reflect.get(iterator, "next")
    if (typeof next !== "function") return undefined
    const item = Reflect.apply(next, iterator, [])
    if (typeof item !== "object" || item === null) return undefined
    if (Reflect.get(item, "done") === true) return values
    const value = Reflect.get(item, "value")
    if (typeof value !== "object" || value === null) return undefined
    const valueText = Reflect.get(value, "segment")
    if (typeof valueText !== "string") return undefined
    values.push(valueText)
  }
}
function wordSegments(text: string): Segments {
  const segmented = intlSegments(text)
  if (segmented !== undefined) return { values: segmented, implementation: "intl-word" }
  return { values: text.match(/\s+|[^\s]+/gu) ?? [], implementation: "fallback" }
}
const ACTION_PHRASES = /손 씻기|손과 목|다른 사람의|따뜻하게 하기|마시지 않기|대지 않기|먹지 않기|누르지 않기|떼어 놓기|몸 움직이기|받은 뒤/gu
function actionSegments(text: string): Segments {
  const values: string[] = []
  let offset = 0
  let implementation: Segments["implementation"] = "fallback"
  for (const match of text.matchAll(ACTION_PHRASES)) {
    const before = wordSegments(text.slice(offset, match.index))
    values.push(...before.values, match[0])
    if (before.implementation === "intl-word") implementation = "intl-word"
    offset = match.index + match[0].length
  }
  const after = wordSegments(text.slice(offset))
  if (after.implementation === "intl-word") implementation = "intl-word"
  return { values: [...values, ...after.values], implementation }
}

function splitLongToken(token: string, style: TextStyle, width: number, measure: TextMeasurer): readonly string[] {
  const chunks: string[] = []
  let chunk = ""
  for (const character of token) {
    if (chunk.length > 0 && measure(chunk + character, style) > width) { chunks.push(chunk); chunk = character } else chunk += character
  }
  if (chunk.length > 0) chunks.push(chunk)
  return chunks
}

function wrapParagraph(text: string, style: TextStyle, width: number, measure: TextMeasurer, policy?: "newsletter-actions"): { readonly lines: readonly string[]; readonly implementation: TextLayout["segmenter"] } {
  const segmented = policy === "newsletter-actions" ? actionSegments(text) : wordSegments(text)
  const lines: string[] = []
  let line = ""
  for (const segment of segmented.values) {
    if (measure(segment, style) > width) {
      if (line.trimEnd().length > 0) lines.push(line.trimEnd())
      const chunks = splitLongToken(segment.trim(), style, width, measure)
      lines.push(...chunks.slice(0, -1))
      line = chunks[chunks.length - 1] ?? ""
      continue
    }
    if (line.length > 0 && measure(line + segment, style) > width) { lines.push(line.trimEnd()); line = segment.trimStart() } else line += segment
  }
  if (line.length > 0 || lines.length === 0) lines.push(line.trimEnd())
  return { lines, implementation: segmented.implementation }
}

function lineIssues(lines: readonly string[]): readonly TextLayoutIssue[] {
  const issues = new Set<TextLayoutIssue>()
  for (const line of lines.slice(1)) {
    const normalized = line.trim().replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, "")
    if ([...normalized].length === 1) issues.add("orphan-character")
    if (PARTICLES.has(normalized)) issues.add("orphan-particle")
  }
  return [...issues]
}

export function layoutText(text: string, style: TextStyle, box: TextBox, measure: TextMeasurer = estimatedTextWidth, policy?: "newsletter-actions"): TextLayout {
  const lines: string[] = []
  let implementation: TextLayout["segmenter"] = "fallback"
  for (const paragraph of text.split("\n")) {
    const wrapped = wrapParagraph(paragraph, style, box.width, measure, policy)
    lines.push(...wrapped.lines)
    if (wrapped.implementation === "intl-word") implementation = "intl-word"
  }
  const requiredHeight = lines.length * style.fontSize * style.lineHeight
  return { lines, requiredHeight, overflow: requiredHeight > box.height, issues: lineIssues(lines), segmenter: implementation }
}
