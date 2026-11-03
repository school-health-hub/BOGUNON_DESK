import type {OfficialDocumentDraft} from './types'
import {editOfficialDocumentBody} from './officialDocumentDraftEditing'
export const blankOfficialDraft=():OfficialDocumentDraft=>({title:'',body:'',attachments:'',messenger:'',checklist:''})
export function importedOfficialDraft(text:string,sourceName:string):OfficialDocumentDraft{
 // Keep every extracted character. No OCR, inferred title parsing, or automatic canonicalization.
 return editOfficialDocumentBody({...blankOfficialDraft(),title:sourceName.replace(/\.(pdf|hwpx|odt)$/i,'')||'가져온 공문'},text)
}
export const officialDraftSnapshot=(draft:OfficialDocumentDraft)=>JSON.stringify({title:draft.title,body:draft.body,attachments:draft.attachments,hasTableText:!!draft.tableText?.trim()})
// UI guidance only. The unchanged Rust home-v1 validator remains authoritative.
export function officialDraftSaveIssues(draft:OfficialDocumentDraft):readonly string[]{
 const issues:string[]=[]
 if(!draft.title.trim()||!draft.body.trim())issues.push('제목과 본문을 입력해 주세요.')
 if(/[\r\n\t]/.test(draft.title)||draft.body.includes('\t'))issues.push('home-v1은 제목 줄바꿈과 탭을 지원하지 않습니다. 직접 검토해 수정해 주세요.')
 if((draft.body.match(/끝\./g)??[]).length!==1||!draft.body.trimEnd().endsWith('끝.'))issues.push('home-v1은 본문 마지막의 “끝.” 표기가 정확히 한 번 필요합니다. 원문을 확인한 뒤 직접 편집해 주세요.')
 if(draft.tableText?.trim())issues.push('표 텍스트의 ODT 저장은 지원하지 않습니다.')
 if([draft.title,draft.body,draft.attachments].some(t=>new TextEncoder().encode(t).length>500000||t.includes('\0')))issues.push('제목·본문·붙임의 크기 또는 문자를 확인해 주세요.')
 return issues
}
