import type {CardDesignLayoutV2} from './designSchema'
import type {Frame} from './renderDocument'

export const topicDecorationFrame={x:908,y:60,width:220,height:54} as const satisfies Frame

const sameFrame=(a:Frame,b:Frame):boolean=>a.x===b.x&&a.y===b.y&&a.width===b.width&&a.height===b.height

export function legacyTopicDecorationRepair(card:CardDesignLayoutV2,index:number):Frame|undefined{
  const decoration=card.brand?.seasonalDecoration
  if(index===0||card.officialTemplate!==undefined||card.editorial!==undefined||decoration===undefined)return undefined
  if(!sameFrame(card.titleFrame,{x:72,y:130,width:1056,height:150})
    ||!sameFrame(decoration.frame,{x:72,y:64,width:220,height:120}))return undefined
  return topicDecorationFrame
}
