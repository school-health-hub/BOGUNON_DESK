import { useState } from "react"
import type { NewsletterProject } from "../schema"
import type { NewsletterDesignStateV2 } from "./designSchema"
import { structureCanonicalText } from "./contentStructure"
import { editEditorialSection, selectedSection, updateEditorialTitle } from "./editorialCopyEditing"

type Props = { readonly project: NewsletterProject; readonly design: NewsletterDesignStateV2; readonly topicIndex?: number; readonly onChange: (value: { readonly project: NewsletterProject; readonly design: NewsletterDesignStateV2 }) => void }
export function NewsletterEditorialCopy({ project, design, topicIndex, onChange }: Props) {
  const section = topicIndex === undefined ? undefined : selectedSection(project, design.canonicalProjectRevision, topicIndex)
  const original = section === undefined ? "" : section.userEdit?.text ?? section.aiGenerated.text
  const content = structureCanonicalText(original)
  const [text, setText] = useState(original)
  const [title, setTitle] = useState(topicIndex === undefined ? project.title : project.topics[topicIndex]?.title ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const save = async (): Promise<void> => {
    setSaving(true); setError(undefined)
    try {
      const titled = updateEditorialTitle(project, topicIndex, title)
      const next = topicIndex === undefined || text === original ? { project: titled, design } : await editEditorialSection(titled, design, topicIndex, text, new Date().toISOString())
      onChange(next)
    } catch (failure: unknown) { if (failure instanceof Error) setError(failure.message); else throw failure }
    finally { setSaving(false) }
  }
  return <fieldset className="control-stack"><legend>원고 편집</legend>
    <label>{topicIndex === undefined ? "월별 제목" : "주제 제목"}<input aria-label="원고 제목" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
    {section !== undefined && <><label>부제·실천 수칙<textarea aria-label="부제·실천 수칙 원고" rows={8} value={text} onChange={(event) => setText(event.target.value)} /></label><small>첫 줄은 부제, 다음 줄은 번호 또는 •로 시작하는 실천 항목입니다. 건강정보는 원고에 직접 입력한 내용만 사용합니다.</small><small>현재 원고: {content.kind === "list" ? content.actions.length : 0}개 실천 항목</small></>}
    <button type="button" disabled={saving || title.trim().length === 0} onClick={() => { void save() }}>{saving ? "원고 반영 중…" : "원고 반영"}</button>
    <small>수칙 변경은 원고 Revision에 보존됩니다. 제목은 현재 문서 정보이며 과거 수칙 Revision 복원과 별도로 유지됩니다.</small>
    {error !== undefined && <span role="alert">{error}</span>}
  </fieldset>
}
