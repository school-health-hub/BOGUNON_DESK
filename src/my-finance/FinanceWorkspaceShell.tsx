import {
  ArrowLeft, BarChart3, BriefcaseBusiness, DatabaseBackup,
  Landmark, LockKeyhole, ReceiptText, RefreshCw, WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";

export type FinanceSection = "home" | "income" | "assets" | "investments" | "tax" | "backup";

const navigation = [
  ["home", "재무 홈", BarChart3],
  ["income", "수입 관리", BriefcaseBusiness],
  ["assets", "자산·부채", WalletCards],
  ["investments", "투자 관리", Landmark],
  ["tax", "세금 관리", ReceiptText],
  ["backup", "백업·복원", DatabaseBackup],
] as const;

type Props = Readonly<{
  section: FinanceSection;
  onSectionChange: (section: FinanceSection) => void;
  onClose: () => void;
  onRefresh: () => void;
  qa: boolean;
  loading: boolean;
  busy: boolean;
  children: ReactNode;
}>;

export function FinanceWorkspaceShell({ section, onSectionChange, onClose, onRefresh, qa, loading, busy, children }: Props) {
  return <div className="finance-shell">
    <header className="finance-shell-header">
      <button type="button" className="finance-back" onClick={onClose} disabled={busy}>
        <ArrowLeft size={16} /> {qa ? "QA 앱 종료" : "BOGUNON DESK로 돌아가기"}
      </button>
      <div className="finance-shell-title">
        <span>MY FINANCE</span>
        <strong>나의 재무 워크스페이스</strong>
      </div>
      <div className="finance-shell-status">
        <span><LockKeyhole size={14} /> 이 PC의 암호화 저장소</span>
        <button type="button" aria-label="최신 목록 새로고침" onClick={onRefresh} disabled={loading || busy}>
          <RefreshCw size={15} /> 새로고침
        </button>
      </div>
    </header>
    <div className="finance-shell-body">
      <nav className="finance-nav" aria-label="MY FINANCE 메뉴">
        {navigation.map(([id, label, Icon]) => <button
          type="button"
          key={id}
          className={section === id ? "is-active" : ""}
          aria-current={section === id ? "page" : undefined}
          onClick={() => onSectionChange(id)}
        ><Icon size={17} /><span>{label}</span></button>)}
      </nav>
      <main className="finance-content" id="finance-main">{children}</main>
    </div>
  </div>;
}
