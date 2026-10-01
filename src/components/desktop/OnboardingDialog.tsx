import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Cloud,
  FileText,
  FolderOpen,
  LayoutDashboard,
  ListPlus,
  NotebookPen,
  PackageCheck,
  Palette,
  ShieldCheck,
} from "lucide-react";
import type { AuthStatus } from "../../auth/types";

type OnboardingDialogProps = {
  readonly authStatus: AuthStatus;
  readonly error: string | null;
  readonly step: 1 | 2 | 3;
  readonly onBack: () => void;
  readonly onComplete: () => void;
  readonly onConnectGoogle: () => void;
  readonly onNext: () => void;
};

const workspaceFeatures = [
  [LayoutDashboard, "오늘 업무·일정 확인"],
  [ListPlus, "빠른 업무 추가"],
  [FileText, "공문 작업실"],
  [PackageCheck, "품의 도우미"],
  [FolderOpen, "업무 폴더"],
  [NotebookPen, "빠른 메모"],
  [Palette, "화면 꾸미기"],
] as const;

const privacyGuidance = [
  "BOGUNON DESK는 학생 건강기록 시스템이 아닙니다.",
  "공문/품의 원본 파일은 자동 업로드하지 않습니다.",
  "빠른 메모는 현재 앱 실행 동안만 유지됩니다.",
  "AI API Key는 앱 종료 시 삭제됩니다.",
  "AI 연결은 선택사항입니다.",
  "AI로 보내기 전 학생 이름·학번·연락처·건강정보를 확인해 주세요.",
] as const;

export function OnboardingDialog(props: OnboardingDialogProps) {
  const authPending = props.authStatus === "loading" || props.authStatus === "signingIn";
  return (
    <div className="onboarding-backdrop">
      <section className="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <header>
          <div className="onboarding-dialog__brand"><BriefcaseBusiness size={18} /><span>BOGUNON DESK</span></div>
          <div className="onboarding-dialog__progress" aria-label={`처음 사용 안내 ${props.step}/3`}>
            {[1, 2, 3].map((step) => <span className={step <= props.step ? "is-active" : ""} key={step} />)}
          </div>
        </header>

        <div className="onboarding-dialog__body">
          {props.step === 1 && (
            <div className="onboarding-step">
              <div className="onboarding-step__heading">
                <span>1단계</span>
                <h1 id="onboarding-title">BOGUNON DESK에 오신 것을 환영합니다</h1>
                <p>보건교사를 위한 데스크톱 워크스페이스</p>
              </div>
              <div className="onboarding-feature-list">
                {workspaceFeatures.map(([Icon, label]) => (
                  <div key={label}><Icon size={16} /><span>{label}</span></div>
                ))}
              </div>
            </div>
          )}

          {props.step === 2 && (
            <div className="onboarding-step">
              <div className="onboarding-step__heading">
                <span>2단계</span>
                <h1 id="onboarding-title">BOGUNON 연결</h1>
                <p>BOGUNON과 연결하면 같은 계정의 업무·일정과 화면 설정을 사용할 수 있습니다.</p>
              </div>
              <div className="onboarding-connection-state">
                <Cloud size={22} />
                {props.authStatus === "signedIn"
                  ? <div><strong>Google 계정 연결됨</strong><span>이 PC에서도 BOGUNON 업무와 설정을 사용할 수 있습니다.</span></div>
                  : <div><strong>로그인하지 않음</strong><span>계정 연결은 나중에 설정에서도 할 수 있습니다.</span></div>}
              </div>
              {props.error !== null && <p className="onboarding-dialog__error" role="alert">{props.error}</p>}
            </div>
          )}

          {props.step === 3 && (
            <div className="onboarding-step">
              <div className="onboarding-step__heading">
                <span>3단계</span>
                <h1 id="onboarding-title">개인정보와 로컬 처리</h1>
                <p>업무를 시작하기 전에 저장과 외부 전송 범위를 확인해 주세요.</p>
              </div>
              <ul className="onboarding-privacy-list">
                {privacyGuidance.map((item) => <li key={item}><ShieldCheck size={15} /><span>{item}</span></li>)}
              </ul>
              {props.error !== null && <p className="onboarding-dialog__error" role="alert">{props.error}</p>}
            </div>
          )}
        </div>

        <footer>
          {props.step > 1 && <button type="button" onClick={props.onBack}><ArrowLeft size={14} /> 이전</button>}
          <div>
            {props.step === 1 && <button className="is-primary" type="button" onClick={props.onNext}>다음 <ArrowRight size={14} /></button>}
            {props.step === 2 && props.authStatus !== "signedIn" && (
              <>
                <button type="button" disabled={authPending} onClick={props.onConnectGoogle}>{authPending ? "연결 준비 중..." : "Google 계정 연결"}</button>
                <button className="is-primary" type="button" onClick={props.onNext}>나중에 연결 <ArrowRight size={14} /></button>
              </>
            )}
            {props.step === 2 && props.authStatus === "signedIn" && <button className="is-primary" type="button" onClick={props.onNext}>다음 <ArrowRight size={14} /></button>}
            {props.step === 3 && <button className="is-primary" type="button" onClick={props.onComplete}><CheckCircle2 size={14} /> 시작하기</button>}
          </div>
        </footer>
      </section>
    </div>
  );
}
