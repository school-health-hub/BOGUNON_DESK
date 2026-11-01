import type { CardDesignLayoutV2 } from "./designSchema"

// Intrinsic source-image profile, traced manually; not a page-layout recipe or recovered alpha.
const approvedHeroSha = "6ed886bfb2ccc5894d6c757acbca77fd3caa2dfb22b81125741e2f2e45b628af"
const sourceContour = [{ x: 0, y: 1 }, { x: .08, y: .80 }, { x: .14, y: .70 }, { x: .18, y: .66 }, { x: .19, y: .60 }, { x: .195, y: .575 }, { x: .198, y: .505 }, { x: .218, y: .445 }, { x: .24, y: .408 }, { x: .27, y: .392 }, { x: .30, y: .405 }, { x: .335, y: .445 }, { x: .352, y: .49 }, { x: .354, y: .55 }, { x: .365, y: .60 }, { x: .40, y: .69 }, { x: .42, y: .62 }, { x: .43, y: .57 }, { x: .455, y: .52 }, { x: .49, y: .48 }, { x: .53, y: .46 }, { x: .57, y: .49 }, { x: .61, y: .55 }, { x: .63, y: .62 }, { x: .65, y: .69 }, { x: .68, y: .64 }, { x: .70, y: .58 }, { x: .72, y: .49 }, { x: .74, y: .45 }, { x: .77, y: .44 }, { x: .80, y: .48 }, { x: .82, y: .53 }, { x: .84, y: .60 }, { x: .86, y: .70 }, { x: .92, y: .80 }, { x: 1, y: 1 }] as const
export function approvedHeroMask(card: CardDesignLayoutV2, assets: readonly { readonly id: string; readonly sha256: string }[]): NonNullable<NonNullable<CardDesignLayoutV2["editorial"]>["foregroundMask"]> | undefined {
  const asset = assets.find(value => value.id === card.image.assetId)
  return asset?.sha256 === approvedHeroSha ? { assetId: asset.id, sha256: asset.sha256, sourceWidth: 1536, sourceHeight: 1024, points: sourceContour } : undefined
}
