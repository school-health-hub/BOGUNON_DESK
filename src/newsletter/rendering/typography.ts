import type { TextStyle } from "./designSchema"

export type TextBox = {
  readonly width: number
  readonly height: number
}

export type TextLayout = {
  readonly lines: readonly string[]
  readonly overflow: boolean
  readonly requiredHeight: number
}

export type TextMeasurer = (text: string, style: TextStyle) => number

function glyphWidth(character: string, fontSize: number): number {
  if (/\s/u.test(character)) return fontSize * 0.33
  if (/[\u1100-\u11ff\u3130-\u318f\u3400-\u9fff\uac00-\ud7af]/u.test(character)) return fontSize
  if (/[A-Z0-9]/u.test(character)) return fontSize * 0.68
  return fontSize * 0.56
}

export function estimatedTextWidth(text: string, style: TextStyle): number {
  return [...text].reduce((width, character) => width + glyphWidth(character, style.fontSize), 0)
}

export function layoutText(text: string, style: TextStyle, box: TextBox, measure: TextMeasurer = estimatedTextWidth): TextLayout {
  const lines: string[] = []
  let line = ""
  let width = 0
  for (const character of text) {
    if (character === "\n") {
      lines.push(line)
      line = ""
      width = 0
      continue
    }
    const nextWidth = measure(character, style)
    if (line.length > 0 && width + nextWidth > box.width) {
      lines.push(line.trimEnd())
      line = character.trimStart()
      width = line.length === 0 ? 0 : nextWidth
    } else {
      line += character
      width += nextWidth
    }
  }
  if (line.length > 0 || lines.length === 0) lines.push(line)
  const requiredHeight = lines.length * style.fontSize * style.lineHeight
  return { lines, requiredHeight, overflow: requiredHeight > box.height }
}
