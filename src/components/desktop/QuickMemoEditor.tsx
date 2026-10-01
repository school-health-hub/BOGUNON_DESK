import { Clipboard, Eraser, ExternalLink, Link, ListPlus } from "lucide-react";
import { useMemo } from "react";
import { extractMemoUrls } from "../../quick-memo/extractMemoUrls";
import { memoToTaskDraft } from "../../quick-memo/memoToTaskDraft";

type QuickMemoEditorProps = {
  readonly id: string;
  readonly memo: string;
  readonly mode: "panel" | "widget";
  readonly onChange: (memo: string) => void;
  readonly onCreateTask: (title: string) => void;
  readonly onNotice: (message: string) => void;
  readonly onOpenUrl: (url: string) => Promise<void>;
};

export function QuickMemoEditor({
  id,
  memo,
  mode,
  onChange,
  onCreateTask,
  onNotice,
  onOpenUrl,
}: QuickMemoEditorProps) {
  const urls = useMemo(() => extractMemoUrls(memo), [memo]);
  const taskDraft = useMemo(() => memoToTaskDraft(memo), [memo]);
  const hasMemo = memo !== "";

  const copyMemo = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(memo);
      onNotice("메모를 복사했습니다.");
    } catch {
      onNotice("메모를 복사하지 못했습니다.");
    }
  };

  const clearMemo = (): void => {
    if (window.confirm("빠른 메모를 모두 지울까요?")) onChange("");
  };

  const openUrl = async (url: string): Promise<void> => {
    try {
      await onOpenUrl(url);
    } catch {
      onNotice("링크를 열지 못했습니다.");
    }
  };

  return (
    <div className={`quick-memo-editor is-${mode}`}>
      <label className="sr-only" htmlFor={id}>빠른 메모 입력</label>
      <textarea
        id={id}
        autoFocus={mode === "panel"}
        placeholder="잊기 전에 메모해 두세요."
        value={memo}
        onChange={(event) => onChange(event.currentTarget.value)}
      />

      {urls.length > 0 && (
        <section className="quick-memo-links" aria-label={`메모 링크 ${urls.length}개`}>
          <strong><Link size={13} /> 링크 {urls.length}개</strong>
          <ul>
            {urls.map((url) => (
              <li key={url}>
                <span title={url}>{url.replace(/^https?:\/\//u, "")}</span>
                <button type="button" aria-label={`${url} 열기`} onClick={() => void openUrl(url)}>
                  <ExternalLink size={13} /> 열기
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="quick-memo-actions">
        <span className="quick-memo-count" aria-label={`메모 ${memo.length}자`}>{memo.length.toLocaleString("ko-KR")}자</span>
        <button type="button" disabled={!hasMemo} onClick={() => void copyMemo()}><Clipboard size={14} /> 복사</button>
        <button type="button" disabled={!hasMemo} onClick={clearMemo}><Eraser size={14} /> 비우기</button>
        <button type="button" disabled={taskDraft === null} onClick={() => { if (taskDraft !== null) onCreateTask(taskDraft); }}>
          <ListPlus size={14} /> 업무로 보내기
        </button>
      </div>
    </div>
  );
}
