export const ILLUSTRATED_CARD = {
  cover: { title: { x: 100, y: 145, width: 1000, height: 150 }, lead: { x: 110, y: 305, width: 980, height: 60 }, image: { x: 190, y: 350, width: 700, height: 610 }, mascot: { x: 835, y: 555, width: 275, height: 380 }, closing: { x: 100, y: 1085, width: 1000, height: 50 } },
  body: { title: { x: 100, y: 150, width: 1000, height: 140 }, lead: { x: 100, y: 310, width: 1000, height: 60 }, image: { x: 70, y: 390, width: 470, height: 620 }, mascot: { x: 970, y: 1000, width: 145, height: 140 }, closing: { x: 100, y: 1065, width: 820, height: 70 } },
  actionFrames: Array.from({ length: 4 }, (_, index) => ({ x: 570 + (index % 2) * 280, y: 400 + Math.floor(index / 2) * 305, width: 265, height: 290 })),
  previewFrames: [{ x: 85, y: 395, width: 230, height: 220 }, { x: 885, y: 385, width: 230, height: 160 }, { x: 95, y: 860, width: 230, height: 205 }, { x: 855, y: 935, width: 260, height: 140 }],
} as const
