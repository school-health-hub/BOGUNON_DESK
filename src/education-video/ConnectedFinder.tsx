import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { authService } from '../auth/authService';
import { getSupabaseClient } from '../auth/supabaseClient';
import { useChatGptConnection } from '../chatgpt/ChatGptConnectionContext';
import { ChatGptAccountSettings } from '../components/desktop/ChatGptAccountSettings';
import { OfficialDocumentPanel } from '../components/desktop/OfficialDocumentPanel';
import { openQuickMemoUrl } from '../desktop/actions';
import { useOfficialDocumentSession } from '../official-document/OfficialDocumentSessionContext';
import { createEmptyOfficialDocumentInput, generateOfficialDocumentDraft } from '../official-document/documentGenerator';
import type { OfficialDocumentInput, OfficialDocumentInputField } from '../official-document/types';
import { AiVideoDraftConfirmation } from './AiVideoDraftConfirmation';
import { AiVideoFinder } from './AiVideoFinder';
import { EducationVideoFinder } from './EducationVideoFinder';
import { saveAiCandidate } from './aiLibrary';
import type { AiVideoCandidate, SearchConditions } from './aiVideo';
import { libraryRepository } from './library';
import type { LibraryV2 } from './libraryV2';
import type { FinderAuthStatus } from './searchService';
const fields: readonly OfficialDocumentInputField[] = ['schoolYear', 'schoolName', 'relatedDocument', 'workName', 'target', 'dateTime', 'place', 'method', 'organization', 'peopleCount', 'budget', 'mainContent', 'attachments', 'notes'];
export function ConnectedFinder({ onClose }: { readonly onClose: () => void }) {
 const connection = useChatGptConnection();
 const session = useOfficialDocumentSession();
 const [tab, setTab] = useState<'ai' | 'legacy'>('ai');
 const [settings, setSettings] = useState(false);
 const [documentOpen, setDocumentOpen] = useState(false);
 const [pendingDraft, setPendingDraft] = useState<OfficialDocumentInput | null>(null);
 const [notice, setNotice] = useState('');
 const [library, setLibrary] = useState<LibraryV2>({ version: 2, entries: [] });
 useEffect(() => { let active = true; void libraryRepository.load().then(loaded => { if (active) setLibrary(loaded.library); }).catch(() => { if (active) setNotice('로컬 라이브러리를 읽지 못했습니다. 기존 파일은 유지됩니다.'); }); return () => { active = false; }; }, []);
 const save = async (candidate: AiVideoCandidate, conditions: SearchConditions) => {
  const loaded = await saveAiCandidate(libraryRepository, candidate, { educationTitle: conditions.topic, target: conditions.target, schedule: '', instructions: '' });
  setLibrary(loaded.library);
 };
 const applyDraft = (input: OfficialDocumentInput) => {
  if (session.state.activeAiRequestId !== null) session.dispatch({ type: 'cancelAiRequest', requestId: session.state.activeAiRequestId });
  session.dispatch({ type: 'setPrompt', mode: 'create', prompt: '' });
  session.dispatch({ type: 'setAiResponse', mode: 'create', response: '' });
  session.dispatch({ type: 'selectMode', mode: 'create' });
  session.dispatch({ type: 'updateCreatePurpose', purpose: input.purpose });
  session.dispatch({ type: 'updateCreateWorkArea', workArea: input.workArea });
  fields.forEach(field => session.dispatch({ type: 'updateCreate', field, value: input[field] }));
  session.dispatch({ type: 'setDraft', draft: generateOfficialDocumentDraft(input) });
  setPendingDraft(null); setDocumentOpen(true);
 };
 const draft = (input: OfficialDocumentInput) => {
  const empty = createEmptyOfficialDocumentInput();
  const existing = session.state.draft !== null || fields.some(field => session.state.createInput[field] !== empty[field]) || session.state.outputs.create.aiResponse !== '' || session.state.outputs.create.prompt !== '';
  if (existing) setPendingDraft(input); else applyDraft(input);
 };
 if (documentOpen) return <><button className="aiv-navigation" type="button" onClick={() => setDocumentOpen(false)}>영상 Finder로 돌아가기</button>{notice && <p role="status">{notice}</p>}<OfficialDocumentPanel onClose={() => setDocumentOpen(false)} onNotice={setNotice} onOpenAiSettings={() => { setDocumentOpen(false); setSettings(true); }} onSendSummaryToQuickAdd={() => setNotice('이 화면에서는 빠른 업무 추가로 전송하지 않습니다. 원래 업무판의 공문 작업실에서 연결해 주세요.')} /></>;
 return <>
  <div inert={pendingDraft !== null}>
  <nav className="aiv-navigation" aria-label="영상 Finder 방식"><button type="button" aria-pressed={tab === 'ai'} onClick={() => setTab('ai')}>AI 교육영상 검색</button><button type="button" aria-pressed={tab === 'legacy'} onClick={() => setTab('legacy')}>기존 영상 Finder / 라이브러리</button></nav>
  {notice && <p role="status">{notice}</p>}
  {settings && <section className="aiv-settings" aria-label="Finder AI 연결 설정"><button type="button" onClick={() => setSettings(false)}>연결 설정 닫기</button><ChatGptAccountSettings state={connection.state} models={connection.models} selectedModel={connection.selectedModel} modelsLoading={connection.modelsLoading} modelsError={connection.modelsError} onModelChange={connection.setSelectedModel} onRefreshModels={() => { void connection.refreshModels(); }} onSignIn={() => { void connection.startSignIn(); }} onDisconnect={() => { void connection.disconnect(); }} /></section>}
  {tab === 'ai' ? <AiVideoFinder connection={connection} onClose={onClose} onOpenSettings={() => setSettings(true)} onOpenUrl={openQuickMemoUrl} onSave={save} onDraft={draft} saved={library.entries.flatMap(entry => entry.ai ? [{ candidate: entry.ai, conditions: { topic: entry.teacher.educationTitle, target: entry.teacher.target, minutes: null, publicFirst: true } }] : [])} /> : <LegacyFinder onClose={onClose} />}
  </div>
  {pendingDraft && <AiVideoDraftConfirmation onCancel={() => setPendingDraft(null)} onConfirm={() => applyDraft(pendingDraft)} />}
 </>;
}
function LegacyFinder({ onClose }: { readonly onClose: () => void }) {
 const [auth, setAuth] = useState(authService.getState);
 const [sessionStatus, setSessionStatus] = useState<FinderAuthStatus>('loading');
 useEffect(() => authService.subscribe(setAuth), []);
 useEffect(() => {
  if (auth.status !== 'signedIn') { setSessionStatus(auth.status === 'loading' ? 'loading' : 'signedOut'); return; }
  let active = true; let timer: ReturnType<typeof setTimeout> | null = null;
  const update = (session: Session | null): void => {
   if (!active) return; if (timer !== null) clearTimeout(timer);
   const remaining = (session?.expires_at ?? 0) * 1000 - Date.now();
   if (!session || session.user.id !== auth.user?.id || remaining <= 0) { setSessionStatus('signedOut'); return; }
   setSessionStatus('signedIn'); timer = setTimeout(() => setSessionStatus('signedOut'), Math.min(remaining, 2147483647));
  };
  try {
   const client = getSupabaseClient(); const { data } = client.auth.onAuthStateChange((_event, session) => update(session));
   void client.auth.getSession().then(({ data, error }) => update(error ? null : data.session)).catch(() => { if (active) setSessionStatus('signedOut'); });
   return () => { active = false; if (timer !== null) clearTimeout(timer); data.subscription.unsubscribe(); };
  } catch { setSessionStatus('signedOut'); return () => { active = false; if (timer !== null) clearTimeout(timer); }; }
 }, [auth.status, auth.user?.id]);
 return <EducationVideoFinder onClose={onClose} authStatus={sessionStatus} authIdentity={auth.user?.id ?? ''} />;
}
