import { BookOpenText, FileSpreadsheet, FileText, Files, ShieldCheck, X } from "lucide-react";
import { buildFileDropRouteModel, type FileDropTarget, type FileDropRouteModel } from "../../file-drop/fileDropRouter";
type Props = { readonly paths: readonly string[]; readonly onCancel: () => void; readonly onChoose: (target: FileDropTarget) => void; readonly embedded?:boolean; readonly modelOverride?:FileDropRouteModel; readonly chosenTarget?:FileDropTarget; readonly disabled?:boolean; };
const icons = { "purchase-helper": FileSpreadsheet, "official-document": FileText, "record-helper": BookOpenText } as const;
export function FileDropRouter({ paths, onCancel, onChoose,embedded=false,modelOverride,chosenTarget,disabled=false }: Props) {
  const model = modelOverride??buildFileDropRouteModel(paths); const names = model.names.slice(0,3); const remaining = model.names.length - names.length;
  return <div className={embedded?'p0-file-drop-content':"desktop-panel-backdrop file-drop-router-backdrop"} onMouseDown={embedded?undefined:(e) => { if (e.currentTarget === e.target) onCancel(); }}>
    <section className="file-drop-router" role={embedded?undefined:"dialog"} aria-modal={embedded?undefined:true} aria-labelledby="file-drop-router-title">
      <header><span className="file-drop-router__icon"><Files size={20}/></span><div><h2 id="file-drop-router-title">이 파일로 무엇을 할까요?</h2><p>파일 형식에 맞는 DESK 도구로 바로 전달합니다.</p></div><button type="button" aria-label="파일 보내기 취소" onClick={onCancel}><X size={17}/></button></header>
      <div className="file-drop-router__files">{names.map((name,i)=><span key={name+i}>{name}</span>)}{remaining>0&&<small>외 {remaining}개</small>}</div>
      <div className="file-drop-router__routes">{model.candidates.map((c)=>{const Icon=icons[c.target]; return <button key={c.target} type="button" aria-pressed={chosenTarget===undefined?undefined:chosenTarget===c.target} className={c.recommended?"is-recommended":""} disabled={disabled||!c.enabled} onClick={()=>onChoose(c.target)}><span><Icon size={19}/></span><span><strong>{c.label}{c.recommended?" · 추천":""}</strong><small>{c.enabled?c.description:c.reason}</small></span></button>;})}</div>
      <aside className="file-drop-router__privacy"><ShieldCheck size={16}/><span>원본 파일은 선택한 로컬 도구에만 전달하며, 이 단계에서 외부로 업로드하지 않습니다.</span></aside>
    </section>
  </div>;
}
