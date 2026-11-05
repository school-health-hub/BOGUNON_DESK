import { CalendarPlus, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AuthStatus } from "../../auth/types";
import {
  createInitialEventInput,
  createInitialTaskInput,
  isQuickAddArea,
  isQuickAddTaskCategory,
  isQuickAddTaskPriority,
  type QuickAddInput,
} from "../../workspace-data/workItemCreateService";
import type {
  QuickAddArea,
  QuickAddTaskCategory,
  QuickAddTaskPriority,
} from "../../workspace-data/workItemCreateTypes";

const areaOptions = [
  ["healthWork", "보건업무"],
  ["schoolSchedule", "학교일정"],
  ["personal", "개인"],
  ["exercise", "운동"],
] as const;

const categoryOptions = [
  ["studentHealthScreening", "학생건강검진"], ["additionalScreening", "별도검사"],
  ["infectiousDisease", "감염병"], ["firstAid", "응급처치"], ["medication", "약품관리"],
  ["officialDocument", "공문"], ["training", "연수"], ["event", "행사"],
  ["counseling", "상담"], ["other", "기타"],
] as const;

const priorityOptions = [["high", "높음"], ["normal", "보통"], ["low", "낮음"]] as const;

type QuickAddPanelProps = {
  readonly authStatus: AuthStatus;
  readonly error: string | null;
  readonly initialDate: string;
  readonly initialKind?: "task" | "event";
  readonly initialTaskTitle?: string;
  readonly initialTaskArea?: QuickAddArea;
  readonly initialTaskCategory?: QuickAddTaskCategory;
  readonly initialTaskPriority?: QuickAddTaskPriority;
  readonly initialTaskDueDate?: string;
  readonly isSaving: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (input: QuickAddInput) => Promise<void>;
  readonly storageMode?:'bogunon'|'electron-local';
  readonly saveEnabled?:boolean;
  readonly embedded?:boolean;
  readonly onOpenLocalCalendar?:()=>void;
};

export function QuickAddPanel({
  authStatus,
  error,
  initialDate,
  initialKind = "task",
  initialTaskTitle = "",
  initialTaskArea = "healthWork",
  initialTaskCategory = "other",
  initialTaskPriority = "normal",
  initialTaskDueDate = "",
  isSaving,
  onClose,
  onSubmit,
  storageMode='bogunon',saveEnabled=true,embedded=false,onOpenLocalCalendar,
}: QuickAddPanelProps) {
  const local=storageMode==='electron-local';
  const [kind, setKind] = useState<"task" | "event">(local?'task':initialKind);
  const [task, setTask] = useState(() => ({
    ...createInitialTaskInput(initialDate),
    title: initialTaskTitle,
    area: local?'healthWork':initialTaskArea,
    category: local&&!['training','studentHealthScreening','event','officialDocument'].includes(initialTaskCategory)?'officialDocument':initialTaskCategory,
    priority: initialTaskPriority,
    dueDate: initialTaskDueDate,
  }));
  const [event, setEvent] = useState(() => createInitialEventInput(initialDate));
  const pending = useRef(false);
  const isAuthPending = authStatus === "loading" || authStatus === "signingIn" || authStatus === "signingOut";
  const canSave = saveEnabled && !isSaving && (local || authStatus === "signedIn" && !isAuthPending);

  useEffect(() => {
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if(embedded||keyboardEvent.defaultPrevented)return;
      if (keyboardEvent.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isSaving, onClose,embedded]);

  const submit = async (formEvent: FormEvent<HTMLFormElement>): Promise<void> => {
    formEvent.preventDefault();
    if (!canSave || pending.current) return;
    pending.current = true;
    try {
      await onSubmit(kind === "task" ? task : event);
    } finally {
      pending.current = false;
    }
  };

  return (
    <aside className={`quick-add-panel${embedded?' p0-quick-add':''}`} aria-label="빠른 추가">
      <header>
        <div className="quick-add-panel__title-icon"><CalendarPlus size={17} /></div>
        <div><strong>빠른 추가</strong><span>{local?'이 Electron 앱의 로컬 업무로 저장합니다.':'BOGUNON에 바로 저장합니다.'}</span></div>
        <button type="button" aria-label="빠른 추가 닫기" disabled={isSaving} onClick={onClose}><X size={16} /></button>
      </header>

      <div className="quick-add-panel__tabs" role="tablist" aria-label="추가할 항목 종류">
        <button disabled={isSaving} className={kind === "task" ? "is-active" : ""} type="button" role="tab" aria-selected={kind === "task"} onClick={() => setKind("task")}>업무</button>
        <button disabled={local&&!onOpenLocalCalendar||isSaving} title={local?(onOpenLocalCalendar?'독립 로컬 일정 창으로 이동':'독립 일정·서버 일정 저장은 지원하지 않습니다.'):undefined} className={kind === "event" ? "is-active" : ""} type="button" role="tab" aria-selected={kind === "event"} onClick={() => {if(local&&onOpenLocalCalendar){if(task.title.trim()&&!window.confirm('입력 중인 업무는 저장하지 않고 독립 일정 창으로 이동할까요? 기존 저장 업무는 유지됩니다.'))return;onOpenLocalCalendar();}else setKind('event');}}>일정</button>
      </div>

      <form onSubmit={(formEvent) => void submit(formEvent)}>
        <label>
          <span>{kind === "task" ? "업무 제목" : "일정 제목"}</span>
          <input
            disabled={isSaving}
            autoFocus
            required
            maxLength={120}
            placeholder={kind === "task" ? "추가할 업무를 입력하세요" : "추가할 일정을 입력하세요"}
            value={kind === "task" ? task.title : event.title}
            onChange={(changeEvent) => {
              const value = changeEvent.currentTarget.value;
              if (kind === "task") setTask((current) => ({ ...current, title: value }));
              else setEvent((current) => ({ ...current, title: value }));
            }}
          />
        </label>
        <label>
          <span>{kind === "task" ? "수행일" : "날짜"}</span>
          <input
            disabled={isSaving}
            required
            type="date"
            value={kind === "task" ? task.date : event.date}
            onChange={(changeEvent) => {
              const value = changeEvent.currentTarget.value;
              if (kind === "task") setTask((current) => ({ ...current, date: value }));
              else setEvent((current) => ({ ...current, date: value }));
            }}
          />
        </label>
        {kind === "task" && (
          <label>
            <span>마감일 (선택)</span>
            <input
            disabled={isSaving}
              type="date"
              value={task.dueDate}
              onChange={(changeEvent) => {
                const value = changeEvent.currentTarget.value;
                setTask((current) => ({ ...current, dueDate: value }));
              }}
            />
            <small className="quick-add-panel__date-help">제출·회신 등 실제 마감일이 있을 때만 입력하세요.</small>
          </label>
        )}
        {!local&&<label>
          <span>영역</span>
          <select
            disabled={isSaving}
            value={kind === "task" ? task.area : event.area}
            onChange={(changeEvent) => {
              const value = changeEvent.currentTarget.value;
              if (!isQuickAddArea(value)) return;
              if (kind === "task") setTask((current) => ({ ...current, area: value }));
              else setEvent((current) => ({ ...current, area: value }));
            }}
          >
            {(kind === "task" ? areaOptions : [areaOptions[1], areaOptions[0], areaOptions[2], areaOptions[3]]).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>}
        {kind === "task" && (
          <>
            <label>
              <span>{local?'업무 분류':'업무 카테고리'}</span>
              <select disabled={isSaving} value={task.category} onChange={(changeEvent) => {
                const value = changeEvent.currentTarget.value;
                if (isQuickAddTaskCategory(value)) setTask((current) => ({ ...current, category: value }));
              }}>
                {(local?[['training','교육'],['studentHealthScreening','검진'],['event','행사'],['officialDocument','보고']]:categoryOptions).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>우선순위</span>
              <select disabled={isSaving} value={task.priority} onChange={(changeEvent) => {
                const value = changeEvent.currentTarget.value;
                if (isQuickAddTaskPriority(value)) setTask((current) => ({ ...current, priority: value }));
              }}>
                {priorityOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
          </>
        )}

        {!local&&authStatus === "signedOut" && <p className="quick-add-panel__auth">저장하려면 Google 계정을 연결해 주세요.</p>}
        {local&&<p>날짜가 있는 로컬 업무만 저장합니다. {onOpenLocalCalendar?'독립 일정은 별도 일정 창에서 저장합니다. 서버 동기화·계정 연결은 지원하지 않습니다.':'독립 일정·시간 일정·서버 동기화·계정 연결은 지원하지 않습니다.'}</p>}
        {error !== null && <p className="quick-add-panel__error" role="alert">{error}</p>}
        <p className="quick-add-panel__helper">{local?'학생·교직원 개인정보와 건강정보는 입력하지 마세요.':'상세 기록이나 개인정보가 필요한 내용은 BOGUNON에서 관리하세요.'}</p>
        <div className="quick-add-panel__actions">
          <button type="button" disabled={isSaving} onClick={onClose}>취소</button>
          <button className="is-primary" type="submit" disabled={!canSave}>{isSaving ? "저장 중..." : "저장"}</button>
        </div>
      </form>
    </aside>
  );
}
