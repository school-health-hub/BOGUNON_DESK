export const ILLUSTRATED_CARD = {
  cover: { title: { x: 100, y: 135, width: 1000, height: 135 }, lead: { x: 110, y: 270, width: 980, height: 60 }, image: { x: 150, y: 330, width: 900, height: 680 }, mascot: { x: 760, y: 630, width: 250, height: 270 }, closing: { x: 100, y: 1085, width: 1000, height: 50 } },
  body: { title: { x: 100, y: 150, width: 1000, height: 140 }, lead: { x: 100, y: 310, width: 1000, height: 60 }, image: { x: 60, y: 385, width: 530, height: 650 }, mascot: { x: 930, y: 995, width: 140, height: 140 }, closing: { x: 100, y: 1065, width: 820, height: 70 } },
  actionFrames: Array.from({ length: 4 }, (_, index) => ({ x: 570 + (index % 2) * 280, y: 400 + Math.floor(index / 2) * 305, width: 265, height: 290 })),
  previewFrames: [{ x: 60, y: 420, width: 250, height: 210 }, { x: 890, y: 410, width: 250, height: 220 }, { x: 65, y: 805, width: 260, height: 220 }, { x: 870, y: 800, width: 270, height: 220 }],
} as const
