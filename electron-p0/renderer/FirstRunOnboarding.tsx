import { useState } from 'react';
import { Check, LayoutDashboard, Monitor, ShieldCheck } from 'lucide-react';
import { SurfaceDialog } from './SurfaceDialog';
import './onboarding.css';

type StartMode = 'window' | 'palette';
type OnboardingProps = Readonly<{ onComplete: (mode: StartMode, openAccount: boolean) => Promise<void> }>;

export function FirstRunOnboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<StartMode>('palette');
  const [openAccount, setOpenAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const finish = async (fallback?: StartMode) => {
    if (saving) return;
    setSaving(true);
    setError('');
    try { await onComplete(openAccount ? 'window' : fallback ?? mode, openAccount); }
    catch { setError('시작 설정을 저장하지 못했습니다. 기존 자료는 유지됩니다. 다시 시도해 주세요.'); }
    finally { setSaving(false); }
  };
  const next = () => setStep(current => Math.min(3, current + 1));
  return <SurfaceDialog title="BOGUNON DESK 시작 안내" onClose={() => void finish('window')} closeDisabled={saving} overlayClassName="first-run-overlay">
    <div className="first-run">
      <p className="first-run-progress" aria-label={`${step + 1}단계 / 4단계`}>시작 안내 {step + 1} / 4</p>
      {step === 0 && <section><div className="first-run-emblem" aria-hidden="true"><ShieldCheck size={34}/></div><h2>BOGUNON DESK에 오신 것을 환영합니다.</h2><p>보건교사의 일정과 로컬 업무 도구를 한곳에서 사용할 수 있습니다. 필요한 위젯만 바탕화면에 두고, 전체 업무는 Workspace에서 진행하세요.</p></section>}
      {step === 1 && <section><h2>어떤 화면으로 시작할까요?</h2><p>두 화면은 Dock과 설정에서 언제든 오갈 수 있습니다.</p><div className="first-run-options">
        <button type="button" aria-pressed={mode === 'window'} onClick={() => setMode('window')}><LayoutDashboard size={24}/><strong>Workspace</strong><span>전체 일정과 업무 도구를 한 창에서 봅니다.</span>{mode === 'window' && <Check size={18}/>}</button>
        <button type="button" aria-pressed={mode === 'palette'} onClick={() => setMode('palette')}><Monitor size={24}/><strong>Desktop Palette</strong><span>Windows 바탕화면에 필요한 위젯만 띄웁니다.</span>{mode === 'palette' && <Check size={18}/>}</button>
      </div><p className="first-run-help">Palette의 아래 Dock을 누르면 Workspace 업무 창을 열 수 있습니다. Workspace를 닫아도 Palette는 남습니다.</p></section>}
      {step === 2 && <section><h2>계정 연결은 선택 사항입니다.</h2><p>BOGUNON Google 계정을 연결하면 계정에 등록된 학교 정보를 확인할 수 있습니다. 공문·기록·구매 등 지원되는 로컬 업무 도구는 연결하지 않아도 사용할 수 있습니다.</p><div className="first-run-options">
        <button type="button" aria-pressed={openAccount} onClick={() => setOpenAccount(true)}><ShieldCheck size={24}/><strong>설정에서 계정 연결하기</strong><span>안내를 마친 뒤 계정 설정을 엽니다. 로그인은 직접 진행합니다.</span></button>
        <button type="button" aria-pressed={!openAccount} onClick={() => setOpenAccount(false)}><Check size={24}/><strong>나중에 연결하기</strong><span>로컬 업무부터 시작하고 필요할 때 설정에서 연결합니다.</span></button>
      </div><p className="first-run-help">학교 업무포털·나이스 로그인과 BOGUNON 계정 연결은 별개입니다.</p></section>}
      {step === 3 && <section><div className="first-run-emblem" aria-hidden="true"><Check size={34}/></div><h2>준비가 끝났습니다.</h2><p>{openAccount ? '시작하면 Workspace 설정에서 계정 연결을 직접 진행할 수 있습니다.' : mode === 'window' ? 'Workspace에서 업무 도구를 살펴보세요. Dock에서 바탕화면 위젯도 사용할 수 있습니다.' : '바탕화면 위젯에서 시작합니다. Dock을 누르면 전체 Workspace가 열립니다.'}</p><p>학교 정보와 위젯 배치는 나중에 설정에서 바꿀 수 있습니다.</p></section>}
      {error && <p role="alert">{error}</p>}
      <div className="first-run-actions">{step > 0 && <button type="button" disabled={saving} onClick={() => setStep(current => current - 1)}>이전</button>}{step < 3 ? <><button type="button" disabled={saving} onClick={() => void finish('window')}>건너뛰고 업무 창 열기</button><button type="button" className="first-run-primary" onClick={next}>다음</button></> : <button type="button" className="first-run-primary" disabled={saving} onClick={() => void finish()}>{saving ? '저장 중…' : 'BOGUNON DESK 시작하기'}</button>}</div>
    </div>
  </SurfaceDialog>;
}
