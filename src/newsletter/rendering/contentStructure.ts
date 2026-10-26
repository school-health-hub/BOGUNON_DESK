const LIST_PREFIX = /^\s*(?:[-*•‣▪◦]|\d+[.)])\s+/u

export type StructuredSectionText =
  | { readonly kind: "paragraph"; readonly body: string }
  | { readonly kind: "list"; readonly lead?: string; readonly actions: readonly string[] }

export function structureCanonicalText(text: string): StructuredSectionText {
  const lines = text.split(/\r?\n/u).filter((line) => line.trim().length > 0)
  const marked = lines.some((line) => LIST_PREFIX.test(line))
  if (lines.length < 2 && !marked) return { kind: "paragraph", body: text }
  const lead = marked && lines[0] !== undefined && !LIST_PREFIX.test(lines[0]) ? lines[0] : undefined
  const actions = lead === undefined ? lines : lines.slice(1)
  return { kind: "list", ...(lead === undefined ? {} : { lead }), actions }
}
