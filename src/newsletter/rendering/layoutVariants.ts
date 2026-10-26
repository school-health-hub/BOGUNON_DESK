import type { CardDesignLayoutV2, NewsletterDesignStateV2 } from "./designSchema"

export type NewsletterLayoutVariant = "balanced" | "image-focus" | "text-focus"

export const NEWSLETTER_ACCENTS = ["#4f9178", "#d98251", "#5f8fb9", "#8a76ad", "#4f9699", "#6d8d67"] as const

const RATIOS: Readonly<Record<NewsletterLayoutVariant, number>> = {
  balanced: 0.34,
  "image-focus": 0.42,
  "text-focus": 0.27,
}

export function variantFromRatio(ratio: number): NewsletterLayoutVariant {
  if (ratio >= 0.39) return "image-focus"
  if (ratio <= 0.3) return "text-focus"
  return "balanced"
}

export function a4ModuleRatio(
  frame: NewsletterDesignStateV2["a4Layout"]["modules"][number]["frame"],
  ratio: number,
) {
  const innerWidth = frame.width - 40
  const imageWidth = Math.round((innerWidth - 20) * ratio)
  const textX = frame.x + 20 + imageWidth + 20
  const textWidth = innerWidth - imageWidth - 20
  return {
    titleFrame: { x: frame.x + 20, y: frame.y + 18, width: innerWidth, height: 46 },
    leadFrame: { x: textX, y: frame.y + 78, width: textWidth, height: 38 },
    actionListFrame: { x: textX, y: frame.y + 124, width: textWidth, height: 160 },
    closingFrame: { x: frame.x + 20, y: frame.y + 304, width: innerWidth, height: 44 },
    imageFrame: { x: frame.x + 20, y: frame.y + 78, width: imageWidth, height: 206 },
    imageTextColumnRatio: ratio,
  }
}

export function a4ModuleVariant(frame: NewsletterDesignStateV2["a4Layout"]["modules"][number]["frame"], variant: NewsletterLayoutVariant) {
  const ratio = variant === "balanced" ? 0.3 : RATIOS[variant]
  return a4ModuleRatio(frame, ratio)
}

export function cardRatio(index: number, ratio: number) {
  if (index === 0) {
    return {
      leadFrame: { x: 72, y: 412, width: 660, height: 68 },
      actionListFrame: { x: 72, y: 620, width: 1056, height: 420 },
      closingFrame: { x: 72, y: 1030, width: 1056, height: 74 },
      imageFrame: { x: 782, y: 126, width: 346, height: 390 },
      imageTextColumnRatio: ratio,
    }
  }
  const contentWidth = 1056
  const gap = 40
  const imageWidth = Math.round((contentWidth - gap) * ratio)
  const textWidth = contentWidth - gap - imageWidth
  return {
    leadFrame: { x: 72 + imageWidth + gap, y: 360, width: textWidth, height: 72 },
    actionListFrame: { x: 72 + imageWidth + gap, y: 450, width: textWidth, height: 500 },
    closingFrame: { x: 72, y: 1000, width: 1056, height: 88 },
    imageFrame: { x: 72, y: 360, width: imageWidth, height: 590 },
    imageTextColumnRatio: ratio,
  }
}

export function cardVariant(index: number, variant: NewsletterLayoutVariant) {
  const ratio = variant === "balanced" ? 0.3 : RATIOS[variant]
  return cardRatio(index, ratio)
}

export function coverLayoutFrames(layout: CardDesignLayoutV2["coverLayout"]) {
  switch (layout) {
    case "feature-center":
      return {
        titleFrame: { x: 150, y: 130, width: 900, height: 210 },
        imageFrame: { x: 390, y: 360, width: 420, height: 300 },
        topicsFrame: { x: 72, y: 700, width: 1056, height: 360 },
      }
    case "feature-right":
      return {
        titleFrame: { x: 72, y: 130, width: 650, height: 250 },
        imageFrame: { x: 782, y: 126, width: 346, height: 390 },
        topicsFrame: { x: 72, y: 620, width: 1056, height: 420 },
      }
    case "topics-grid":
      return {
        titleFrame: { x: 72, y: 130, width: 650, height: 250 },
        imageFrame: { x: 782, y: 126, width: 346, height: 390 },
        topicsFrame: { x: 72, y: 620, width: 1056, height: 420 },
      }
  }
}
