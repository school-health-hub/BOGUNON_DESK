import type {TextStyle} from './designSchema'
import {describe,expect,it} from 'vitest'
import {fitCoverTitle} from './coverTitleFit'
import {estimatedTextWidth,layoutText} from './typography'
import {createNewsletterProject} from '../project'
import {createNewsletterDesignState} from './designSchema'
import {upgradeNewsletterDesignStateV2} from './designState'
import {compileRenderDocument} from './renderDocument'
const style={fontFamily:'Pretendard',fontSize:76,fontWeight:800,lineHeight:1.25,color:'#183b4e',align:'left'} as const
const frame={width:620,height:260}
const titles=['11월 보건소식지','2026년 11월 · 남녀공학 보건소식지','우리 학교 학생들과 함께 실천하는 건강한 학교생활과 계절별 보건소식지','공백이거의없는긴한글보건소식지제목을안전하게표시합니다','11월\n보건소식지'] as const
describe('bounded cover title fitting',()=>{
 for(const title of titles)it(`fits ${title}`,()=>{const fitted=fitCoverTitle(title,style,frame);const text=layoutText(title,fitted,frame);expect(text.overflow).toBe(false);expect(text.lines.every(line=>estimatedTextWidth(line,fitted)<=frame.width)).toBe(true);expect(fitted.fontSize).toBeGreaterThanOrEqual(38);expect(fitted.fontSize).toBeLessThanOrEqual(style.fontSize)})
 it('keeps a fitting short title style and source unchanged',()=>{expect(fitCoverTitle(titles[0],style,frame)).toBe(style);expect(titles[0]).toBe('11월 보건소식지')})
 it('leaves an honest overflow at the readability floor instead of truncating or shrinking indefinitely',()=>{const title='긴제목'.repeat(100);const fitted=fitCoverTitle(title,style,frame);expect(fitted.fontSize).toBe(38);expect(layoutText(title,fitted,frame).overflow).toBe(true)})
 it('uses the actual injected font measurer',()=>{const measure=(text:string,s:TextStyle)=>[...text].length*s.fontSize;const fitted=fitCoverTitle(titles[1],style,frame,measure);expect(layoutText(titles[1],fitted,frame,measure).overflow).toBe(false)})
 it('preserves project/design bytes, A4 and noncover cards while fitting the shared render title',async()=>{
  const now='2026-11-13T00:00:00.000Z',project=await createNewsletterProject({projectId:'ns01-r1',title:titles[1],now});const design=upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now}),now);const before=JSON.stringify({project,design});const rendered=compileRenderDocument({project,projectRevision:1,design,designRevision:design.designRevision});expect(rendered.issues.filter(value=>value.blockId==='card-cover-title'&&value.kind==='overflow')).toEqual([]);expect(rendered.cards[0]?.title.text).toBe(titles[1]);expect(rendered.cards[0]?.title.frame).toEqual(design.cardLayouts[0]?.titleFrame);expect(JSON.stringify({project,design})).toBe(before);expect(rendered.cards).toHaveLength(7)
 })
})
it('does not leave an orphan character that blocks output for a space-free cover',async()=>{const now='2026-11-13T00:00:00.000Z',project=await createNewsletterProject({projectId:'unspaced-title',title:titles[3],now}),design=upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now}),now);const rendered=compileRenderDocument({project,projectRevision:1,design,designRevision:design.designRevision});expect(rendered.issues.filter(issue=>issue.blockId==='card-cover-title')).toEqual([])})
