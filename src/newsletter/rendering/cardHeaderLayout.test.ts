import {describe,expect,it} from 'vitest'
import {createNewsletterDesignState,parseNewsletterDesignStateV2} from './designSchema'
import {applyCardLayoutVariant,applyEditorialLayout,restoreDesignRevision,updateCardLayout,upgradeNewsletterDesignStateV2} from './designState'
import {bFixture} from '../../../electron-p0/tests/newsletter-b-fixture'

const now='2026-11-12T00:00:00.000Z'
const legacyFrame={x:72,y:64,width:220,height:120} as const
const fixture=()=>upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:'header-qa',canonicalProjectRevision:1,now}),now)
const legacyFixture=()=>parseNewsletterDesignStateV2(updateCardLayout(fixture(),{cardIndex:2,now,patch:{brand:{seasonalDecoration:{frame:legacyFrame}}}}))

describe('topic card header spacing',()=>{
  it('keeps generated decorations inside the square safe area and clear of two-line titles and date badges',()=>{
    // Given / When: a product-generated V2 layout, not edited fixture coordinates.
    const design=fixture()
    // Then: all six topic headers leave space above the existing title frame.
    for(const card of design.cardLayouts.slice(1)){
      const decoration=card.brand?.seasonalDecoration
      if(!decoration)throw Error('missing generated decoration')
      const f=decoration.frame
      expect(f.x).toBeGreaterThanOrEqual(60)
      expect(f.y).toBeGreaterThanOrEqual(60)
      expect(f.x+f.width).toBeLessThanOrEqual(1140)
      expect(f.y+f.height+16).toBeLessThanOrEqual(card.titleFrame.y)
      expect(f.x).toBeGreaterThanOrEqual(88+420+16)
      expect(card.titleStyle.fontSize*card.titleStyle.lineHeight*2).toBeLessThanOrEqual(card.titleFrame.height)
    }
  })

  it('repairs only the selected legacy default when its existing layout action is explicitly applied',()=>{
    // Given: old V2 data remains unchanged on parsing.
    const legacy=legacyFixture(),before=structuredClone(legacy)
    expect(parseNewsletterDesignStateV2(legacy)).toEqual(before)
    // When: use the existing layout variant action.
    const fixed=applyCardLayoutVariant(legacy,{cardIndex:2,variant:'balanced',now})
    // Then: only its decoration frame is repaired, with history and unrelated layouts intact.
    const selected=fixed.cardLayouts[2],original=legacy.cardLayouts[2]
    if(!selected?.brand?.seasonalDecoration||!original?.brand?.seasonalDecoration)throw Error('missing topic')
    expect(selected.brand.seasonalDecoration.frame.y+selected.brand.seasonalDecoration.frame.height+16).toBeLessThanOrEqual(selected.titleFrame.y)
    expect(selected.brand.seasonalDecoration).toEqual({...original.brand.seasonalDecoration,frame:selected.brand.seasonalDecoration.frame})
    expect(selected.brand.mascot).toEqual(original.brand.mascot)
    expect(fixed.a4Layout).toEqual(legacy.a4Layout)
    expect(fixed.assetManifest).toEqual(legacy.assetManifest)
    expect(fixed.cardLayouts.filter((_card,index)=>index!==2)).toEqual(legacy.cardLayouts.filter((_card,index)=>index!==2))
    expect(fixed.revisionHistory.slice(0,-1)).toEqual(legacy.revisionHistory)
    expect(fixed.revisionHistory.at(-1)?.changedPageIds).toEqual([selected.pageId])
    expect(legacy).toEqual(before)
    expect(restoreDesignRevision(fixed,{revision:legacy.designRevision,now}).cardLayouts).toEqual(legacy.cardLayouts)
  })

  it.each(['decoration','title'] as const)('preserves author-customized %s coordinates on layout selection',kind=>{
    // Given: a customization cannot safely be inferred to be the legacy default.
    const legacy=legacyFixture()
    const custom=parseNewsletterDesignStateV2(updateCardLayout(legacy,{cardIndex:2,now,patch:kind==='decoration'?{brand:{seasonalDecoration:{frame:{x:800}}}}:{titleFrame:{y:60}}}))
    // When / Then: the existing action must not silently rewrite that header.
    const next=applyCardLayoutVariant(custom,{cardIndex:2,variant:'balanced',now})
    expect(next.cardLayouts[2]?.brand).toEqual(custom.cardLayouts[2]?.brand)
    expect(next.cardLayouts[2]?.titleFrame).toEqual(custom.cardLayouts[2]?.titleFrame)
  })

  it('leaves official and editorial compositions under their existing layout owners',()=>{
    // Given: these layouts have their own header composition contracts.
    const official=bFixture().design
    if(official.designSchemaVersion!==2)throw Error('expected V2 fixture')
    const editorial=applyEditorialLayout(legacyFixture(),{cardIndex:2,layoutType:'B',now})
    // When / Then: the generic variant action cannot repair their brand frames.
    expect(applyCardLayoutVariant(official,{cardIndex:1,variant:'balanced',now}).cardLayouts[1]?.brand).toEqual(official.cardLayouts[1]?.brand)
    expect(applyCardLayoutVariant(editorial,{cardIndex:2,variant:'balanced',now}).cardLayouts[2]?.brand).toEqual(editorial.cardLayouts[2]?.brand)
  })
})
