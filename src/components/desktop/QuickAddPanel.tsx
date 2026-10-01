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
}: QuickAddPanelProps) {
  const [kind, setKind] = useState<"task" | "event">(initialKind);
  const [task, setTask] = useState(() => ({
    ...createInitialTaskInput(initialDate),
    title: initialTaskTitle,
    area: initialTaskArea,
    category: initialTaskCategory,
    priority: initialTaskPriority,
    dueDate: initialTaskDueDate,
  }));
  const [event, setEvent] = useState(() => createInitialEventInput(initialDate));
  const pending = useRef(false);
  const isAuthPending = authStatus === "loading" || authStatus === "signingIn" || authStatus === "signingOut";
  const canSave = authStatus === "signedIn" && !isAuthPending && !isSaving;

  useEffect(() => {
    const closeOnEscape = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isSaving, onClose]);

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
    <aside className="quick-add-panel" aria-label="빠른 추가">
      <header>
        <div className="quick-add-panel__title-icon"><CalendarPlus size={17} /></div>
        <div><strong>빠른 추가</strong><span>BOGUNON에 바로 저장합니다.</span></div>
        <button type="button" aria-label="빠른 추가 닫기" disabled={isSaving} onClick={onClose}><X size={16} /></button>
      </header>

      <div className="quick-add-panel__tabs" role="tablist" aria-label="추가할 항목 종류">
        <button className={kind === "task" ? "is-active" : ""} type="button" role="tab" aria-selected={kind === "task"} onClick={() => setKind("task")}>업무</button>
        <button className={kind === "event" ? "is-active" : ""} type="button" role="tab" aria-selected={kind === "event"} onClick={() => setKind("event")}>일정</button>
      </div>

      <form onSubmit={(formEvent) => void submit(formEvent)}>
        <label>
          <span>{kind === "task" ? "업무 제목" : "일정 제목"}</span>
          <input
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
        <label>
          <span>영역</span>
          <select
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
        </label>
        {kind === "task" && (
          <>
            <label>
              <span>업무 카테고리</span>
              <select value={task.category} onChange={(changeEvent) => {
                const value = changeEvent.currentTarget.value;
                if (isQuickAddTaskCategory(value)) setTask((current) => ({ ...current, category: value }));
              }}>
                {categoryOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>우선순위</span>
              <select value={task.priority} onChange={(changeEvent) => {
                const value = changeEvent.currentTarget.value;
                if (isQuickAddTaskPriority(value)) setTask((current) => ({ ...current, priority: value }));
              }}>
                {priorityOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
          </>
        )}

        {authStatus === "signedOut" && <p className="quick-add-panel__auth">저장하려면 Google 계정을 연결해 주세요.</p>}
        {error !== null && <p className="quick-add-panel__error" role="alert">{error}</p>}
        <p className="quick-add-panel__helper">상세 기록이나 개인정보가 필요한 내용은 BOGUNON에서 관리하세요.</p>
        <div className="quick-add-panel__actions">
          <button type="button" disabled={isSaving} onClick={onClose}>취소</button>
          <button className="is-primary" type="submit" disabled={!canSave}>{isSaving ? "저장 중..." : "저장"}</button>
        </div>
      </form>
    </aside>
  );
}
