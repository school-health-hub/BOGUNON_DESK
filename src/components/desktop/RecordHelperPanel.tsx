import { BookOpenCheck, ShieldAlert, X } from "lucide-react";
import { useEffect, useReducer, useRef } from "react";
import { recordHelperPrivacyNotice } from "../../record-helper/privacyGuard";
import { createRecordHelperSession, reduceRecordHelperSession } from "../../record-helper/recordHelperSession";

type RecordHelperPanelProps = {
  readonly onClose: () => void;
};

export function RecordHelperPanel({ onClose }: RecordHelperPanelProps) {
  const [session, dispatch] = useReducer(reduceRecordHelperSession, undefined, createRecordHelperSession);
  const activityMemoRef = useRef<HTMLTextAreaElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activityMemoRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    if (session.check.status !== "idle") {
      statusRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [session.check.status]);

  return (
    <div className="record-helper-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="record-helper-panel" role="dialog" aria-modal="true" aria-labelledby="record-helper-title" aria-describedby="record-helper-description">
        <header>
          <div className="record-helper-panel__title-icon"><BookOpenCheck size={18} /></div>
          <div>
            <strong id="record-helper-title">생기부 도우미</strong>
            <span id="record-helper-description">비식별 활동·관찰 메모를 정리해 기록 문구를 준비합니다.</span>
          </div>
          <button type="button" aria-label="생기부 도우미 닫기" onClick={onClose}><X size={16} /></button>
        </header>

        <div className="record-helper-panel__body">
          <div className="record-helper-panel__privacy" role="note">
            <ShieldAlert size={18} aria-hidden="true" />
            <div>
              <strong>학생 이름·학번·연락처·건강정보 등 개인을 식별할 수 있는 정보는 입력하지 마세요.</strong>
              <span>{recordHelperPrivacyNotice}</span>
            </div>
          </div>

          <label className="record-helper-panel__field" htmlFor="record-helper-activity-memo">
            <span><strong>비식별 활동·관찰 메모</strong><small>필수</small></span>
            <textarea
              ref={activityMemoRef}
              id="record-helper-activity-memo"
              value={session.activityMemo}
              placeholder="예: 모둠 활동에서 자료를 정리하고 발표 준비에 꾸준히 참여함"
              onChange={(event) => dispatch({ type: "updateActivityMemo", value: event.currentTarget.value })}
            />
          </label>

          <label className="record-helper-panel__field" htmlFor="record-helper-writing-request">
            <span><strong>작성 요청 / 강조할 점</strong><small>선택</small></span>
            <textarea
              id="record-helper-writing-request"
              value={session.writingRequest}
              placeholder="예: 협업 과정과 책임감을 중심으로 정리"
              onChange={(event) => dispatch({ type: "updateWritingRequest", value: event.currentTarget.value })}
            />
          </label>

          <div ref={statusRef} className={`record-helper-panel__status is-${session.check.status}`} aria-live="polite">
            {session.check.status === "idle" && "입력 내용은 이 화면의 메모리에만 유지됩니다."}
            {session.check.status === "empty" && session.check.message}
            {session.check.status === "blocked" && (
              <>
                <strong>개인정보 또는 민감정보로 보이는 내용이 있어 점검을 중단했습니다.</strong>
                <span>확인 항목: {session.check.findings.join(", ")}</span>
              </>
            )}
            {session.check.status === "ready" && session.check.message}
          </div>
        </div>

        <footer>
          <span>외부 전송이나 자동 저장 없이 현재 입력만 점검합니다.</span>
          <button type="button" onClick={() => dispatch({ type: "checkInput" })}>
            <BookOpenCheck size={15} /> 입력 내용 점검
          </button>
        </footer>
      </section>
    </div>
  );
}
