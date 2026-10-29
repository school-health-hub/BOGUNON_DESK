import { CheckCircle2, FlaskConical, MonitorUp, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { sendQaEditCommand, type QaEditCommand } from "./editCommands";

type Props = Readonly<{ sourceSha: string }>;

const qaChecks = [
  { label: "합성 projection", detail: "여섯 위젯에는 테스트 정보만 전달됩니다.", icon: FlaskConical },
  { label: "운영 저장소 분리", detail: "QA 전용 데이터·WebView 경로만 사용합니다.", icon: ShieldCheck },
  { label: "Surface 연결 대기", detail: "격리된 Surface Host가 준비되면 자동으로 시작합니다.", icon: MonitorUp },
] as const;

export function SurfaceQaMain({ sourceSha }: Props) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("편집 명령 대기 중");

  const send = async (command: QaEditCommand) => {
    setBusy(true);
    setResult("명령 전송 중");
    try {
      await sendQaEditCommand(command);
      setEditing(command === "begin");
      setResult(command === "begin" ? "편집 모드 시작됨" : command === "complete" ? "편집 완료됨" : "편집 취소됨");
    } catch {
      setResult("명령을 처리하지 못했습니다");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="surface-qa-shell">
      <section className="surface-qa-sheet" aria-labelledby="surface-qa-title">
        <div className="surface-qa-badge"><FlaskConical size={16} aria-hidden="true" /> SYNTHETIC ONLY</div>
        <header>
          <p className="surface-qa-eyebrow">BOGUNON DESK</p>
          <h1 id="surface-qa-title">Desktop Surface QA</h1>
          <p>운영 앱과 분리된 Windows 실행 검증용 화면입니다.</p>
        </header>
        <ul className="surface-qa-checks">
          {qaChecks.map(({ label, detail, icon: Icon }) => (
            <li key={label}>
              <span className="surface-qa-icon"><Icon size={18} aria-hidden="true" /></span>
              <span><strong>{label}</strong><small>{detail}</small></span>
              <CheckCircle2 className="surface-qa-ready" size={18} aria-label="준비됨" />
            </li>
          ))}
        </ul>
        <section className="surface-qa-edit" aria-labelledby="surface-qa-edit-title">
          <div>
            <p className="surface-qa-edit-label">NATIVE EDIT CONTROL</p>
            <h2 id="surface-qa-edit-title">위젯 편집 검증</h2>
            <p>세션 범위의 고정 명령만 Main → Host → Renderer 경로로 전달합니다.</p>
          </div>
          <div className="surface-qa-edit-actions">
            {!editing ? (
              <button type="button" disabled={busy} onClick={() => void send("begin")}>편집 시작</button>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={() => void send("complete")}>편집 완료</button>
                <button className="surface-qa-secondary" type="button" disabled={busy} onClick={() => void send("cancel")}>편집 취소</button>
              </>
            )}
          </div>
          <output aria-live="polite">{result}</output>
        </section>
        <footer>
          <span>Source</span>
          <code>{sourceSha.slice(0, 12)}</code>
        </footer>
      </section>
    </main>
  );
}
