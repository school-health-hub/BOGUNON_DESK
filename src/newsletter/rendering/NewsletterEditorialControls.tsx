import { applyIllustratedCardPreset } from "./illustratedCardPreset"
import { applySkillMasterPreset } from "./skillMasterPreset"
import { parseNewsletterDesignStateV2, type CardDesignLayoutV2, type NewsletterDesignStateV2 } from "./designSchema"
import { applyEditorialLayout, updateCardLayout as updateDesignCard } from "./designState"
import { editorialFrames } from "./editorialLayout"

function updateCardLayout(design: NewsletterDesignStateV2, input: Parameters<typeof updateDesignCard>[1]): NewsletterDesignStateV2 { return parseNewsletterDesignStateV2(updateDesignCard(design, input)) }
type Editorial = NonNullable<CardDesignLayoutV2["editorial"]>
type Props = { readonly design: NewsletterDesignStateV2; readonly cardIndex: number; readonly actionCount: number; readonly onChange: (design: NewsletterDesignStateV2) => void }
const now = (): string => new Date().toISOString()
function layoutType(value: string): Editorial["layoutType"] | undefined { switch (value) { case "A": case "B": case "C": case "D": return value; default: return undefined } }
function composition(value: string): Editorial["studentComposition"] { switch (value) { case "female": case "male": case "objects": return value; default: return "mixed" } }
function season(value: string): Editorial["season"] { switch (value) { case "spring": case "summer": case "autumn": case "winter": return value; default: return "none" } }
export function AssetChoice({ label, value, design, onChange }: { readonly label: string; readonly value: string | undefined; readonly design: NewsletterDesignStateV2; readonly onChange: (assetId: string) => void }) {
  const assets = design.assetManifest.filter((asset) => asset.approvalStatus === "approved" && asset.registry?.usageScope === "newsletter-output" && asset.registry.purpose === "illustration" && asset.registry.classification !== "OFFICIAL_REFERENCE")
  return <label>{label}<select aria-label={label} value={value ?? ""} onChange={(event) => onChange(event.target.value)}><option value="" disabled>등록된 삽화 선택</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</select>{assets.length === 0 && <small>사용 가능한 승인 삽화를 먼저 등록해 주세요.</small>}</label>
}
export function NewsletterEditorialControls({ design, cardIndex, actionCount, onChange }: Props) {
  const card = design.cardLayouts[cardIndex]
  if (card === undefined) return null
  const config = card.editorial
  const update = (patch: Partial<Editorial>): void => { if (config !== undefined) onChange(updateCardLayout(design, { cardIndex, now: now(), patch: { editorial: { ...config, ...patch } } })) }
  const setModule = (index: number, assetId: string): void => {
    if (config === undefined) return
    const frames = editorialFrames(config.layoutType).moduleImageFrames
    const images = config.moduleImages ?? frames.map((frame, moduleIndex) => ({ slotId: `editorial-${cardIndex}-module-${moduleIndex + 1}`, frame, fit: "contain" as const }))
    update({ moduleImages: images.map((image, moduleIndex) => moduleIndex === index ? { ...image, assetId } : image) })
  }
  const scaleModule = (index: number, percent: number): void => {
    if (config?.moduleImages === undefined) return
    const frame = editorialFrames(config.layoutType).moduleImageFrames[index]
    if (frame === undefined) return
    const ratio = percent / 100
    update({ moduleImages: config.moduleImages.map((image, moduleIndex) => moduleIndex === index ? { ...image, frame: { x: frame.x + frame.width * (1 - ratio) / 2, y: frame.y + frame.height * (1 - ratio) / 2, width: frame.width * ratio, height: frame.height * ratio } } : image) })
  }
  return <fieldset className="control-stack"><legend>편집형 카드 구성</legend>
    {cardIndex > 0 && <button type="button" disabled={actionCount !== 4} onClick={() => onChange(applyIllustratedCardPreset(design, { cardIndex, now: now() }))}>삽화형 A·B · 표지·선택 카드 적용</button>}
    {cardIndex > 0 && <button type="button" disabled={actionCount !== 4} onClick={() => onChange(applySkillMasterPreset(design, { cardIndex, now: now() }))}>9월 스킬 기본형 · A4·표지·선택 카드 적용</button>}
    {config?.compositionPreset === "september-master" && <p role="status">9월 스킬 기본형이 적용되었습니다. A/B/C/D를 선택하면 해당 확장 구성으로 전환합니다.</p>}
    <label>편집형 레이아웃<select aria-label="편집형 레이아웃" value={config?.compositionPreset !== undefined ? "master" : config?.layoutType ?? "legacy"} onChange={(event) => {
      const type = layoutType(event.target.value)
      onChange(type === undefined ? updateCardLayout(design, { cardIndex, now: now(), patch: { editorial: null } }) : applyEditorialLayout(design, { cardIndex, layoutType: type, now: now() }))
    }}>{config?.compositionPreset !== undefined && <option value="master">{config.compositionPreset === "illustrated-ab" ? "삽화형 A·B" : "9월 스킬 기본형"}</option>}<option value="legacy">기존 V2 구조 유지</option>{cardIndex === 0 ? <option value="A">TYPE A · 표지형</option> : <><option value="B" disabled={actionCount !== 4}>TYPE B · 2×2 교육형</option><option value="C" disabled={actionCount !== 4}>TYPE C · 비대칭 스토리형</option><option value="D" disabled={actionCount !== 4}>TYPE D · 안내·서비스형</option></>}</select></label>
    {cardIndex > 0 && actionCount !== 4 && <p role="status">편집형 레이아웃에는 실천 항목 4개가 필요합니다. 현재 {actionCount}개입니다. 원고를 확인해 주세요.</p>}
    {config !== undefined && <>
      {cardIndex === 0 && <label>표지 학생 구성<select aria-label="표지 학생 구성" value={config.studentComposition} onChange={(event) => onChange(updateCardLayout(design, { cardIndex, now: now(), patch: { editorial: { ...config, studentComposition: composition(event.target.value) }, image: { assetId: undefined } } }))}><option value="female">여학생</option><option value="male">남학생</option><option value="mixed">여학생·남학생 혼합</option><option value="objects">학생 없이 소품·행동 중심</option></select></label>}
      {cardIndex === 0 && <p role="status">학생 구성을 바꾸면 기존 장면을 해제합니다. 선택한 구성에 맞는 승인 대표 장면을 직접 선택해 주세요.{card.image.assetId === undefined ? " 대표 장면 선택이 필요합니다." : " 선택한 장면을 미리보기에서 확인해 주세요."}</p>}
      <label>월별 계절 장식<select aria-label="월별 계절 장식" value={config.season} onChange={(event) => update({ season: season(event.target.value) })}><option value="none">장식 없음</option><option value="spring">봄</option><option value="summer">여름</option><option value="autumn">가을</option><option value="winter">겨울</option></select></label>
      {cardIndex === 0 && <label>월별 슬로건<input aria-label="월별 슬로건" value={config.slogan ?? ""} onChange={(event) => update({ slogan: event.target.value })} /></label>}
      <label>마무리 문구<input aria-label="마무리 문구" value={config.closing ?? ""} onChange={(event) => update({ closing: event.target.value })} /></label>
      <AssetChoice label={cardIndex === 0 ? "표지 대표 장면" : "주제 메인 삽화"} value={card.image.assetId} design={design} onChange={(assetId) => onChange(updateCardLayout(design, { cardIndex, now: now(), patch: { image: { assetId } } }))} />
      {cardIndex > 0 && config.compositionPreset === undefined && [0, 1, 2, 3].map((index) => <div className="control-stack" key={index}><AssetChoice label={`교육 모듈 ${index + 1} 삽화`} value={config.moduleImages?.[index]?.assetId} design={design} onChange={(assetId) => setModule(index, assetId)} /><label>삽화 크기<input aria-label={`교육 모듈 ${index + 1} 삽화 크기`} type="range" min="50" max="120" disabled={config.moduleImages?.[index]?.assetId === undefined} value={Math.round((config.moduleImages?.[index]?.frame.width ?? editorialFrames(config.layoutType).moduleImageFrames[index]?.width ?? 1) / (editorialFrames(config.layoutType).moduleImageFrames[index]?.width ?? 1) * 100)} onChange={(event) => scaleModule(index, Number(event.target.value))} /></label></div>)}
      <label>삽화 맞춤<select aria-label="삽화 맞춤" value={card.image.fit} onChange={(event) => onChange(updateCardLayout(design, { cardIndex, now: now(), patch: { image: { fit: event.target.value === "cover" ? "cover" : "contain" } } }))}><option value="contain">전체 보기</option><option value="cover">프레임 채우기</option></select></label>
      {card.brand !== undefined && <fieldset className="frame-editor"><legend>수달쌤 위치·크기</legend>{([["x", "가로 위치"], ["y", "세로 위치"], ["width", "너비"], ["height", "높이"]] as const).map(([key, label]) => <label key={key}>{label}<input aria-label={`수달쌤 ${label}`} type="number" min={key === "width" || key === "height" ? 1 : 0} value={card.brand?.mascot.frame[key] ?? 0} onChange={(event) => onChange(updateCardLayout(design, { cardIndex, now: now(), patch: { brand: { mascot: { frame: { [key]: Math.max(key === "width" || key === "height" ? 1 : 0, Number(event.target.value)) } } } } }))} /></label>)}</fieldset>}
    </>}
  </fieldset>
}
