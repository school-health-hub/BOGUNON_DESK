import { CheckCircle2, FlaskConical, MonitorUp, ShieldCheck } from "lucide-react";

type Props = Readonly<{ sourceSha: string }>;

const qaChecks = [
  { label: "합성 projection", detail: "여섯 위젯에는 테스트 정보만 전달됩니다.", icon: FlaskConical },
  { label: "운영 저장소 분리", detail: "QA 전용 데이터·WebView 경로만 사용합니다.", icon: ShieldCheck },
  { label: "Surface 연결 대기", detail: "격리된 Surface Host가 준비되면 자동으로 시작합니다.", icon: MonitorUp },
] as const;

export function SurfaceQaMain({ sourceSha }: Props) {
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
        <footer>
          <span>Source</span>
          <code>{sourceSha.slice(0, 12)}</code>
        </footer>
      </section>
    </main>
  );
}
