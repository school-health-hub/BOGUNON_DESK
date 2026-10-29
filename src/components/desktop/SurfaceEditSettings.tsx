import { Check, Pencil, X } from "lucide-react";

export type SurfaceEditMode = "idle" | "editing";

type Props = Readonly<{
  mode: SurfaceEditMode;
  busy: boolean;
  onBegin: () => void;
  onComplete: () => void;
  onCancel: () => void;
}>;

export function SurfaceEditSettings({ mode, busy, onBegin, onComplete, onCancel }: Props) {
  return (
    <div className="desktop-setting-row">
      <div>
        <strong>Desktop Surface 위젯</strong>
        <span>{mode === "editing" ? "Surface에서 위젯을 이동하거나 크기를 조절하세요." : "현재 Surface 세션의 위젯 배치를 편집합니다."}</span>
      </div>
      <div className="desktop-setting-row__actions">
        {mode === "idle" ? (
          <button className="desktop-setting-row__action" type="button" disabled={busy} onClick={onBegin}><Pencil size={13} /> 편집 시작</button>
        ) : (
          <>
            <button className="desktop-setting-row__action" type="button" disabled={busy} onClick={onCancel}><X size={13} /> 취소</button>
            <button className="desktop-setting-row__action" type="button" disabled={busy} onClick={onComplete}><Check size={13} /> 완료</button>
          </>
        )}
      </div>
    </div>
  );
}
