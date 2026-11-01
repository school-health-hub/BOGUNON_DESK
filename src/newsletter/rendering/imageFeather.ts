import type { Frame } from "./renderDocument"

export function imageFeatherGeometry(frame: Frame) {
  const unit = Math.min(frame.width, frame.height)
  const inset = unit * .035
  return { x: frame.x + inset, y: frame.y + inset, width: frame.width - inset * 2, height: frame.height - inset * 2, blur: unit * .018, radius: unit * .04 }
}
