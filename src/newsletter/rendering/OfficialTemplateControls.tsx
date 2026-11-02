import type { ReactNode } from "react"
import { useState } from "react"
import type { NewsletterDesignStateV2 } from "./designSchema"
import { updateOfficialElementFrame, updateOfficialTemplateClosing } from "./officialTemplate"

type Props = { readonly renderTextEditor?: (binding: string) => ReactNode; readonly design: NewsletterDesignStateV2; readonly cardIndex: number; readonly actionCount: number; readonly onChange: (design: NewsletterDesignStateV2) => void }
export function OfficialTemplateControls({ design, cardIndex, onChange, renderTextEditor }: Props) {
  const [selected, setSelected] = useState("")
  const [error, setError] = useState("")
  const template = design.cardLayouts[cardIndex]?.officialTemplate
  const element = template?.elements.find(value => value.id === selected) ?? template?.elements[0]
  const selectableAssets = design.assetManifest.filter(asset => asset.approvalStatus === "approved" && (asset.registry === undefined || (asset.registry.usageScope === "newsletter-output" && asset.registry.classification !== "OFFICIAL_REFERENCE" && asset.registry.purpose !== "reference")))
  const now = (): string => new Date().toISOString()
  return <fieldset className="control-stack"><legend>공식 편집형 템플릿</legend>
    {template !== undefined && <>
      <p role="note">편집형 B안 기술 이식 · 디자인 REVISE / PENDING · 자산 출력 승인은 별도입니다.</p>
      <p role="status">{template.kind === "cover" ? "공식 표지" : "공식 교육형"} · 요소를 선택해 위치와 크기를 조정하세요.</p>
      <p>적용 전 문서 상태는 Revision 복원에서 다시 열 수 있습니다.</p>
      <label>공식 마무리 문구<textarea aria-label="공식 마무리 문구" maxLength={1000} value={template.closingText ?? design.cardLayouts[cardIndex]?.editorial?.closing ?? ""} onChange={event => onChange(updateOfficialTemplateClosing(design, { cardIndex, text: event.target.value, now: now() }))} /></label>
      <label>공식 요소<select aria-label="공식 요소" value={element?.id ?? ""} onChange={event => setSelected(event.target.value)}>{template.elements.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label>
      {element !== undefined && <fieldset className="frame-editor"><legend>{element.label} 위치·크기</legend>{([["x", "가로 위치"], ["y", "세로 위치"], ["width", "너비"], ["height", "높이"]] as const).map(([key, label]) => <label key={key}>{label}<input type="number" aria-label={`공식 요소 ${label}`} min={key === "width" || key === "height" ? 1 : 0} max="1200" value={element.frame[key]} onChange={event => {
        try {
          onChange(updateOfficialElementFrame(design, { cardIndex, elementId: element.id, patch: { [key]: Number(event.target.value) }, now: now() }))
          setError("")
        } catch (caught: unknown) {
          if (caught instanceof Error) setError("요소가 1200×1200 카드 안에 들어오도록 위치와 크기를 입력해 주세요.")
          else throw caught
        }
      }} /></label>)}</fieldset>}
      {element !== undefined && <label>겹침 순서<input type="number" aria-label="공식 요소 겹침 순서" min="0" max="100" value={element.zOrder} onChange={event => { const value=Number(event.target.value); if(Number.isInteger(value)&&value>=0&&value<=100)onChange(updateOfficialElementFrame(design,{cardIndex,elementId:element.id,patch:{},zOrder:value,now:now()})); }} /></label>}
      {element?.kind === "text" && <>
        {renderTextEditor?.(element.binding)}
        <label>글자 크기<input type="number" min="8" max="200" aria-label="공식 요소 글자 크기" value={element.style.fontSize} onChange={event => { const size = Number(event.target.value); if (size >= 8 && size <= 200) onChange(updateOfficialElementFrame(design, { cardIndex, elementId: element.id, patch: {}, style: { fontSize: size }, now: now() })) }} /></label>
        <label>글자 색<input type="color" aria-label="공식 요소 글자 색" value={element.style.color} onChange={event => onChange(updateOfficialElementFrame(design, { cardIndex, elementId: element.id, patch: {}, style: { color: event.target.value }, now: now() }))} /></label>
      </>}
      {element?.kind === "image" && <>
        <label><input type="checkbox" aria-label="공식 요소 표시" checked={element.visible !== false} onChange={event => onChange(updateOfficialElementFrame(design, { cardIndex, elementId: element.id, patch: {}, visible: event.target.checked, now: now() }))} />{element.binding === "mascot" ? "수달쌤 표시" : "삽화 표시"}</label>
        <label>이미지 자산<select aria-label="공식 요소 이미지 자산" value={element.assetId ?? ""} onChange={event => {const assetId=event.target.value;if(!selectableAssets.some(asset=>asset.id===assetId)){setError("사용 가능한 승인 삽화를 선택해 주세요.");return;}onChange(updateOfficialElementFrame(design,{cardIndex,elementId:element.id,patch:{},assetId,now:now()}));setError("");}}><option value="" disabled>기존 슬롯 자산 사용</option>{selectableAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</select></label>
        <label>삽화 맞춤<select aria-label="공식 요소 삽화 맞춤" value={element.fit} onChange={event => onChange(updateOfficialElementFrame(design, { cardIndex, elementId: element.id, patch: {}, fit: event.target.value === "cover" ? "cover" : "contain", now: now() }))}><option value="contain">전체 보기</option><option value="cover">프레임 채우기</option></select></label>
        {element.mask !== undefined && <label><input type="checkbox" aria-label="공식 요소 마스크 표시" checked={element.maskEnabled !== false} onChange={event => onChange(updateOfficialElementFrame(design, { cardIndex, elementId: element.id, patch: {}, maskEnabled: event.target.checked, now: now() }))} />장면 마스크 표시</label>}
      </>}
      {template.elements.some(value => value.kind === "image" && value.maskedOnly === true && value.mask === undefined) && <p role="status">교체한 삽화에는 이전 장면 마스크를 적용하지 않아 해당 보조 장면은 숨겨집니다. 전경 중첩에는 새 경계 검수가 필요합니다.</p>}
      {error.length > 0 && <p role="alert">{error}</p>}
    </>}
  </fieldset>
}
