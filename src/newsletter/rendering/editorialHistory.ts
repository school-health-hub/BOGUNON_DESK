import type { CardDesignLayoutV2, NewsletterDesignStateV2 } from "./designSchema"

export function legacyEditorialCard(design: NewsletterDesignStateV2, cardIndex: number, fallback: CardDesignLayoutV2): CardDesignLayoutV2 {
  const current = design.cardLayouts[cardIndex] ?? fallback
  let source = fallback
  for (const entry of [...design.revisionHistory].reverse()) {
    if (entry.snapshotVersion !== 2) continue
    const candidate = entry.snapshot.cardLayouts[cardIndex]
    if (candidate !== undefined && candidate.editorial === undefined) { source = candidate; break }
  }
  return {
    ...source,
    image: { ...source.image, assetId: current.image.assetId },
    ...(source.brand === undefined ? {} : { brand: {
      ...source.brand,
      mascot: { ...source.brand.mascot, assetId: current.brand?.mascot.assetId },
      ...(source.brand.seasonalDecoration === undefined ? {} : { seasonalDecoration: { ...source.brand.seasonalDecoration, assetId: current.brand?.seasonalDecoration?.assetId } }),
    } }),
  }
}
