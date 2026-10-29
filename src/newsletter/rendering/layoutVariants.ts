import type { CardDesignLayoutV2, NewsletterDesignStateV2 } from "./designSchema"

export type NewsletterLayoutVariant = "balanced" | "image-focus" | "text-focus"

export const NEWSLETTER_ACCENTS = ["#4f9178", "#d98251", "#5f8fb9", "#8a76ad", "#4f9699", "#6d8d67"] as const

const RATIOS: Readonly<Record<NewsletterLayoutVariant, number>> = {
  balanced: 0.4,
  "image-focus": 0.46,
  "text-focus": 0.3,
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
  const innerWidth = frame.width - 36
  const imageWidth = Math.round((innerWidth - 20) * ratio)
  const textX = frame.x + 18 + imageWidth + 18
  const textWidth = innerWidth - imageWidth - 20
  return {
    titleFrame: { x: frame.x + 58, y: frame.y + 16, width: innerWidth - 58, height: 48 },
    leadFrame: { x: textX, y: frame.y + 78, width: textWidth, height: 36 },
    actionListFrame: { x: textX, y: frame.y + 120, width: textWidth, height: 218 },
    closingFrame: { x: frame.x + 18, y: frame.y + 328, width: innerWidth, height: 24 },
    imageFrame: { x: frame.x + 18, y: frame.y + 80, width: imageWidth, height: 238 },
    imageTextColumnRatio: ratio,
  }
}

export function a4ModuleVariant(frame: NewsletterDesignStateV2["a4Layout"]["modules"][number]["frame"], variant: NewsletterLayoutVariant) {
  return a4ModuleRatio(frame, RATIOS[variant])
}

export function cardRatio(index: number, ratio: number) {
  if (index === 0) {
    return {
      leadFrame: { x: 72, y: 500, width: 620, height: 64 },
      actionListFrame: { x: 72, y: 808, width: 1056, height: 276 },
      closingFrame: { x: 72, y: 1090, width: 1056, height: 44 },
      imageFrame: { x: 710, y: 170, width: 418, height: 570 },
      imageTextColumnRatio: ratio,
    }
  }
  const contentWidth = 1056
  const gap = 36
  const imageWidth = Math.round((contentWidth - gap) * ratio)
  const textWidth = contentWidth - gap - imageWidth
  return {
    leadFrame: { x: 72, y: 306, width: 1056, height: 58 },
    actionListFrame: { x: 72 + imageWidth + gap, y: 392, width: textWidth, height: 500 },
    closingFrame: { x: 182, y: 1024, width: 836, height: 72 },
    imageFrame: { x: 72, y: 392, width: imageWidth, height: 500 },
    imageTextColumnRatio: ratio,
  }
}

export function cardVariant(index: number, variant: NewsletterLayoutVariant) {
  return cardRatio(index, RATIOS[variant])
}

export function coverLayoutFrames(layout: CardDesignLayoutV2["coverLayout"]) {
  switch (layout) {
    case "feature-center":
      return {
        titleFrame: { x: 120, y: 210, width: 650, height: 260 },
        imageFrame: { x: 720, y: 160, width: 408, height: 580 },
        topicsFrame: { x: 72, y: 808, width: 1056, height: 276 },
      }
    case "feature-right":
      return {
        titleFrame: { x: 72, y: 210, width: 620, height: 260 },
        imageFrame: { x: 710, y: 170, width: 418, height: 570 },
        topicsFrame: { x: 72, y: 808, width: 1056, height: 276 },
      }
    case "topics-grid":
      return {
        titleFrame: { x: 72, y: 210, width: 620, height: 260 },
        imageFrame: { x: 710, y: 170, width: 418, height: 570 },
        topicsFrame: { x: 72, y: 808, width: 1056, height: 276 },
      }
  }
}
