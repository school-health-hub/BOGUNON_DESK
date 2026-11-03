import {it,expect} from 'vitest'
import {blankOfficialDraft,importedOfficialDraft,officialDraftSaveIssues,officialDraftSnapshot} from './localDocumentFlow'
it('keeps extracted text unchanged and derives attachment metadata through the existing editor',()=>{
 const text='합성 원문\n붙임\n1. 합성 자료 1부.\n끝.';const draft=importedOfficialDraft(text,'합성 원고.odt')
 expect(draft.title).toBe('합성 원고');expect(draft.body).toBe(text);expect(draft.attachments).toBe('붙임\n1. 합성 자료 1부.\n끝.');expect(officialDraftSaveIssues(draft)).toEqual([])
 expect(officialDraftSnapshot(draft)).toBe(JSON.stringify({title:draft.title,body:text,attachments:draft.attachments,hasTableText:false}))
})
it('does not silently repair invalid imported text or relax home-v1 limits',()=>{
 expect(officialDraftSaveIssues(blankOfficialDraft())).toContain('제목과 본문을 입력해 주세요.')
 for(const text of ['끝 표기 없는 합성 원문','본문 끝. 다시 끝.','표\t텍스트\n끝.']){const draft=importedOfficialDraft(text,'합성.pdf');expect(draft.body).toBe(text);expect(officialDraftSaveIssues(draft).length).toBeGreaterThan(0)}
 expect(officialDraftSaveIssues({...importedOfficialDraft('본문\n끝.','합성.hwpx'),tableText:'표'})).toContain('표 텍스트의 ODT 저장은 지원하지 않습니다.')
})
