import { useEffect, useRef, useState } from 'react';
import { CircleHelp, ShieldCheck } from 'lucide-react';
import type { AccountReview, AccountState } from '../../account-protocol';
import type { SchoolLoad } from '../../school-protocol';
import { SurfaceDialog } from '../SurfaceDialog';

const statusText: Record<AccountState['status'], string> = {
  signedOut: '연결되지 않음',
  signingIn: 'Google 로그인 진행 중',
  signingOut: '연결 해제 중',
  signedIn: '연결됨',
  expired: '로그인 기간이 끝남',
  temporaryError: '연결 상태를 확인하지 못함',
  storageError: '이 PC의 보안 저장소를 사용할 수 없음',
};

function AccountReviewModal({ review, onAnswer }: { readonly review: AccountReview; readonly onAnswer: (accepted: boolean) => void }) {
  const signIn = review.kind === 'signIn';
  const applySchool = review.kind === 'applySchool';
  const title = signIn ? 'BOGUNON 계정 연결' : applySchool ? '학교 정보 적용' : '계정 연결 해제';
  const action = signIn ? 'Google 계정으로 연결하기' : applySchool ? '학교 정보 적용하기' : '연결 해제하기';
  return <SurfaceDialog title={title} onClose={() => onAnswer(false)} overlayClassName="account-review-overlay">
    <div className="account-review">
      <div className="account-review-icon" aria-hidden="true">{signIn ? <ShieldCheck size={28}/> : <CircleHelp size={28}/>}</div>
      <p className="account-review-lead">{signIn ? 'BOGUNON에서 사용하던 Google 계정을 연결하시겠어요?' : applySchool ? '계정에 등록된 학교를 이 PC의 학교 정보로 적용하시겠어요?' : '이 PC의 BOGUNON 계정 연결을 해제하시겠어요?'}</p>
      <ul>
        {signIn ? <><li>기본 브라우저에서 Google 로그인 화면이 열립니다.</li><li>이 PC에 저장된 메모와 설정은 유지됩니다.</li><li>연결하지 않아도 지원되는 로컬 업무 도구를 사용할 수 있습니다.</li></> : applySchool ? <><li>선택한 학교 정보만 이 PC에 저장합니다.</li><li>기존 업무 자료와 학교 업무 주소는 자동으로 바뀌지 않습니다.</li></> : <><li>계정의 서버 조회 상태가 정리됩니다.</li><li>이 PC에서 직접 저장한 메모·학교 정보·업무 자료는 유지됩니다.</li></>}
      </ul>
      {applySchool && <details><summary>적용할 학교 확인</summary><pre>{review.detail}</pre></details>}
      <div className="account-review-actions"><button type="button" className="account-review-primary" onClick={() => onAnswer(true)}>{action}</button><button type="button" onClick={() => onAnswer(false)}>{signIn ? '나중에 연결하기' : '취소'}</button></div>
    </div>
  </SurfaceDialog>;
}

export function BogunonAccount({ local, onSchoolApplied }: { readonly local: SchoolLoad | null; readonly onSchoolApplied: () => Promise<void> }) {
  const api = window.electronWork.account;
  const [state, setState] = useState<AccountState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState<AccountReview | null>(null);
  const live = useRef(true);
  const locked = useRef(false);
  const sequence = useRef(0);
  const reviewRef = useRef<AccountReview | null>(null);
  reviewRef.current = review;

  const load = async () => {
    if (!api || locked.current) return;
    const ticket = ++sequence.current;
    try {
      const result = await api.status();
      if (!result.ok) throw Error(result.error.message);
      if (live.current && ticket === sequence.current) setState(result.data);
    } catch {
      if (live.current) setError('계정 상태를 불러오지 못했습니다. 로컬 자료는 유지됩니다. 잠시 후 다시 확인해 주세요.');
    }
  };
  useEffect(() => {
    live.current = true;
    const unsubscribe = api?.onReview?.(setReview);
    void load();
    return () => {
      live.current = false;
      sequence.current++;
      if (reviewRef.current) api?.answerReview?.({ id: reviewRef.current.id, accepted: false });
      unsubscribe?.();
    };
  }, [api]);
  useEffect(() => {
    if (state?.status !== 'signingIn') return;
    const timer = setInterval(() => void load(), 1000);
    return () => clearInterval(timer);
  }, [state?.status, api]);
  const answerReview = (accepted: boolean) => {
    if (!review) return;
    api?.answerReview?.({ id: review.id, accepted });
    setReview(null);
    if (!accepted) setNotice('계정 작업을 진행하지 않았습니다. 기존 자료는 유지됩니다.');
  };
  const run = async (action: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    sequence.current++;
    setError('');
    setNotice('');
    try { await action(); }
    catch (cause) { if (live.current) setError(cause instanceof Error ? cause.message : '계정 작업을 완료하지 못했습니다. 다시 시도해 주세요.'); }
    finally { locked.current = false; if (live.current) { setBusy(false); void load(); } }
  };
  const action = (kind: 'signIn' | 'signOut' | 'cancel' | 'refresh') => void run(async () => {
    if (!api) return;
    const result = await api[kind]();
    if (!result.ok) throw Error(result.error.message);
    if (live.current) setState(result.data);
  });
  if (!api) return <p>이 버전에서는 계정 연결을 사용할 수 없습니다. 로컬 업무 도구는 계속 사용할 수 있습니다.</p>;
  return <section className="bogunon-account" aria-label="BOGUNON 계정 연결">
    <h3>BOGUNON 계정 연결</h3>
    <p>Google 계정을 연결하면 계정에 등록된 학교 정보를 확인할 수 있습니다. 학교 업무포털·나이스·eVPN 로그인과는 별개입니다.</p>
    <p className="school-profile-status" role="status"><strong>연결 상태: {state ? statusText[state.status] : '확인 중'}</strong>{state?.status === 'signingIn' && <span> 기본 브라우저에서 로그인을 마치거나 아래에서 취소하세요.</span>}</p>
    {state&&!state.configured&&<p role="alert">계정 연결에 필요한 앱 설정이 준비되지 않았습니다. 로컬 업무 도구는 계속 사용할 수 있습니다. 관리자에게 문의해 주세요.</p>}
    {state&&state.configured&&!state.secureStorage&&<p role="alert">이 PC의 보안 저장소를 사용할 수 없어 계정 연결을 시작할 수 없습니다. 로컬 자료는 유지됩니다.</p>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {state?.user && <p>현재 계정: {state.user.displayName ?? state.user.email ?? '연결된 계정'}</p>}
    <div className="account-actions"><button type="button" disabled={busy || !state?.configured || !state.secureStorage || state.status === 'signingIn' || state.status === 'storageError'} onClick={() => action('signIn')}>{state?.status === 'signedIn' ? '다른 Google 계정으로 연결' : state?.status === 'expired' ? 'Google 계정 다시 연결하기' : 'Google 계정으로 연결하기'}</button>
      {state?.status === 'signingIn' && <button type="button" disabled={busy} onClick={() => action('cancel')}>로그인 취소</button>}
      <button type="button" disabled={busy || !state?.secureStorage} onClick={() => action('signOut')}>연결 해제하기</button>
      <button type="button" disabled={busy || state?.status === 'signingIn'} onClick={() => action('refresh')}>연결 상태 다시 확인</button></div>
    {state?.school ? <><p>계정에 등록된 학교: {state.school.schoolName} · {state.school.officeName}</p><p>이 PC의 학교: {local?.document.school?.schoolName ?? '설정하지 않음'}. 확인 후 적용할 수 있으며 기존 업무 자료와 주소는 그대로 유지됩니다.</p>
      <button type="button" disabled={busy || !local || local.recovered || state.status !== 'signedIn'} onClick={() => void run(async () => { if (!local) return; const result = await api.applySchool({ accountRevision: state.revision, expectedSchoolRevision: local.document.revision }); if (!result.ok) throw Error(result.error.message); if (result.data && live.current) await onSchoolApplied(); })}>계정 학교 확인 후 이 PC에 적용</button></> : <p>계정에 등록된 학교가 없거나 확인되지 않았습니다. 아래에서 학교를 검색할 수 있습니다.</p>}
    <p>계정 연결을 해제해도 직접 저장한 로컬 자료는 삭제되지 않습니다. 실제 학교 정보 적용은 별도 확인 후 진행합니다.</p>
    {state?.message && <details><summary>연결 상태 자세히 보기</summary><p>{state.message}</p>{state.user && <p>계정 식별자: {state.user.id}</p>}</details>}
    {review && <AccountReviewModal review={review} onAnswer={answerReview}/>}
  </section>;
}
