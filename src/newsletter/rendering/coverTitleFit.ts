import type {TextStyle} from './designSchema'
import {estimatedTextWidth,layoutText,type TextBox,type TextMeasurer} from './typography'

/** Render-only, never expands a saved frame or modifies the source title. */
export function fitCoverTitle(text:string,style:TextStyle,box:TextBox,measure:TextMeasurer=estimatedTextWidth):TextStyle {
 const fits=(candidate:TextStyle):boolean=>{
  const layout=layoutText(text,candidate,box,measure)
  return !layout.overflow&&layout.lines.every(line=>measure(line,candidate)<=box.width)
 }
 if(fits(style))return style
 const minimum=Math.min(style.fontSize,Math.max(32,Math.ceil(style.fontSize/2)))
 for(let size=Math.ceil(style.fontSize)-1;size>=minimum;size--){
  const candidate={...style,fontSize:size}
  if(fits(candidate))return candidate
 }
 // Unreasonably long text remains a visible validation error at this floor.
 return {...style,fontSize:minimum}
}
