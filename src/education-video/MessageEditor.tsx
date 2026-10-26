import { Clipboard, Save } from 'lucide-react';
import type { Education, Video } from './model';
type Props = {
    readonly canSaveTeacher?: boolean;
    readonly education: Education;
    readonly video: Video | null;
    readonly message: string;
    readonly notes: string;
    readonly confirmed: boolean;
    readonly onEducation: (value: Education) => void;
    readonly onMessage: (value: string) => void;
    readonly onNotes: (value: string) => void;
    readonly onConfirm: (value: boolean) => void;
    readonly onGenerate: () => void;
    readonly onCopy: () => void;
    readonly onSave: () => void;
};
export function MessageEditor(p: Props) { return <section className="ev-editor" aria-labelledby="ev-editor-heading"><div className="ev-section-heading"><div><span className="ev-step">03</span><h2 id="ev-editor-heading">메신저 안내문</h2></div></div><p className="ev-muted">입력한 사실만 템플릿에 반영합니다. 자동 발송하지 않습니다.</p>{p.video ? <div className="ev-selection"><strong>{p.video.source === 'live' ? '선택한 영상' : '선택한 합성 영상'}</strong><p>{p.video.title}</p></div> : <p className="ev-empty-inline">먼저 영상을 선택해 주세요.</p>}<label>교육명<input maxLength={200} value={p.education.educationTitle} onChange={e => p.onEducation({ ...p.education, educationTitle: e.target.value })}/></label><label>교육 대상<input maxLength={200} value={p.education.target} onChange={e => p.onEducation({ ...p.education, target: e.target.value })}/></label><label>교육 일시 또는 시청 기간<input maxLength={200} placeholder="예: 2026. 11. 2. ~ 11. 6." value={p.education.schedule} onChange={e => p.onEducation({ ...p.education, schedule: e.target.value })}/></label><label>안내사항<textarea rows={3} maxLength={3000} value={p.education.instructions} onChange={e => p.onEducation({ ...p.education, instructions: e.target.value })}/></label><button type="button" className="ev-primary" onClick={p.onGenerate} disabled={!p.video}>안내문 생성</button><label>안내문 직접 수정<textarea className="ev-message" rows={13} maxLength={20000} value={p.message} onChange={e => p.onMessage(e.target.value)} placeholder="필수 정보를 입력하고 안내문을 생성해 주세요."/></label><label className="ev-confirm"><input type="checkbox" checked={p.confirmed} onChange={e => p.onConfirm(e.target.checked)}/>{p.video?.source === 'live' ? '영상 링크와 안내문 내용을 확인했습니다.' : p.video ? '합성 링크와 안내문 내용을 확인했습니다.' : p.canSaveTeacher ? '보존된 교사 안내문을 확인했습니다. 영상 메타데이터는 만료 또는 삭제 상태입니다.' : '안내문 내용을 확인했습니다.'}</label><div className="ev-actions"><button type="button" disabled={!p.message || !p.confirmed} onClick={p.onCopy}><Clipboard size={16}/>안내문 복사</button><button type="button" disabled={!p.canSaveTeacher && (!p.message || !p.video)} onClick={p.onSave}><Save size={16}/>라이브러리 저장</button></div><label>사용자 메모<textarea rows={2} maxLength={3000} value={p.notes} onChange={e => p.onNotes(e.target.value)}/></label><p className="ev-muted">이번 단계에서는 AI 문구 다듬기를 연결하지 않습니다.<br/>외부로 데이터를 전송하지 않습니다.</p></section>; }
