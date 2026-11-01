import type { CardDesignLayoutV2 } from "./designSchema"
import type { Frame } from "./renderDocument"

export type EditorialLayout = NonNullable<CardDesignLayoutV2["editorial"]>
export type EditorialLayoutType = EditorialLayout["layoutType"]
const frame = (x: number, y: number, width: number, height: number): Frame => ({ x, y, width, height })
function impossible(value: never): never { throw new EditorialLayoutError(`Unknown layout: ${String(value)}`) }
export class EditorialLayoutError extends Error { readonly name = "EditorialLayoutError" }
export function editorialFrames(type: EditorialLayoutType) {
  const header = { titleFrame: frame(80, 110, 880, 190), leadFrame: frame(80, 252, 880, 55), closingFrame: frame(80, 1060, 1040, 72) }
  switch (type) {
    case "A": return { ...header, titleFrame: frame(80, 110, 1040, 176), leadFrame: frame(80, 270, 1040, 70), closingFrame: frame(80, 1070, 660, 62), actionListFrame: frame(72, 355, 1056, 100), imageFrame: frame(170, 490, 570, 570), mascotFrame: frame(780, 780, 310, 350), moduleFrames: Array.from({ length: 4 }, (_, i) => frame(72 + i * 270, 355, 246, 100)), moduleImageFrames: Array.from({ length: 4 }, (_, i) => frame(120 + i * 270, 370, 140, 70)) }
    case "B": {
      const modules = Array.from({ length: 4 }, (_, i) => frame(72 + (i % 2) * 544, 365 + Math.floor(i / 2) * 345, 512, 325))
      return { ...header, actionListFrame: frame(72, 365, 1056, 670), imageFrame: frame(92, 445, 240, 225), mascotFrame: frame(988, 110, 132, 160), moduleFrames: modules, moduleImageFrames: modules.map((f, i) => i === 0 ? frame(f.x + 20, f.y + 80, 240, 225) : frame(f.x + 290, f.y + 158, 200, 150)) }
    }
    case "C": {
      const modules = Array.from({ length: 4 }, (_, i) => frame(650 + (i % 2) * 250, 380 + Math.floor(i / 2) * 320, 225, 290))
      return { ...header, closingFrame: frame(80, 1060, 880, 72), actionListFrame: frame(650, 380, 475, 610), imageFrame: frame(80, 400, 530, 590), mascotFrame: frame(990, 1015, 130, 125), moduleFrames: modules, moduleImageFrames: modules.map(f => frame(f.x + 55, f.y + 190, 115, 80)) }
    }
    case "D": {
      const modules = Array.from({ length: 4 }, (_, i) => frame(610, 380 + i * 165, 510, 145))
      return { ...header, actionListFrame: frame(610, 380, 510, 640), imageFrame: frame(72, 400, 490, 590), mascotFrame: frame(988, 110, 132, 160), moduleFrames: modules, moduleImageFrames: modules.map(f => frame(f.x + 390, f.y + 30, 90, 90)) }
    }
    default: return impossible(type)
  }
}
