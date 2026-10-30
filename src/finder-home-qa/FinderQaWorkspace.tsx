import { useEffect, useState } from 'react';
import { AiVideoFinder } from '../education-video/AiVideoFinder';
import type { AiVideoCandidate, SearchConditions } from '../education-video/aiVideo';
import type { RecommendationReason } from '../education-video/recommendationReason';
import { AiVideoDraftConfirmation } from '../education-video/AiVideoDraftConfirmation';
import { saveAiCandidate } from '../education-video/aiLibrary';
import { candidateFromRecord } from '../education-video/candidateRecord';
import type { LoadedLibrary } from '../education-video/library';
import { LIBRARY_RECOVERY_NOTICE } from '../education-video/library';
import type { LibraryV2 } from '../education-video/libraryV2';
import { OfficialDocumentPanel } from '../components/desktop/OfficialDocumentPanel';
import { useOfficialDocumentSession } from '../official-document/OfficialDocumentSessionContext';
import { createEmptyOfficialDocumentInput, generateOfficialDocumentDraft } from '../official-document/documentGenerator';
import type { OfficialDocumentInput, OfficialDocumentInputField } from '../official-document/types';
import { finderQaConnection, blocked } from './inertConnections';
import { syntheticCandidate, syntheticConditions } from './syntheticFixture';
import { LibraryTools } from './LibraryTools';
import { qaLibraryRepository as libraryRepository } from './qaLibrary';

const fields: readonly OfficialDocumentInputField[] = ['schoolYear', 'schoolName', 'relatedDocument', 'workName', 'target', 'dateTime', 'place', 'method', 'organization', 'peopleCount', 'budget', 'mainContent', 'attachments', 'notes'];
export function FinderQaWorkspace() {
  const session = useOfficialDocumentSession();
  const [library, setLibrary] = useState<LibraryV2>({ version: 2, entries: [] });
  const [notice, setNotice] = useState('합성 후보만 사용합니다. 실제 검색·외부 URL·AI 생성은 차단됩니다.');
  const [documentOpen, setDocumentOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<OfficialDocumentInput | null>(null);
  const loaded = (value: LoadedLibrary) => { setLibrary(value.library); if (value.recovered) setNotice(LIBRARY_RECOVERY_NOTICE); };
  useEffect(() => { let active = true; void libraryRepository.load().then(value => { if (active) loaded(value); }).catch((error: unknown) => {
    if (!(error instanceof Error) && typeof error !== 'string') throw error;
    if (active) setNotice('QA 라이브러리를 읽지 못했습니다. 기존 파일은 유지됩니다.');
  }); return () => { active = false; }; }, []);
  const applyDraft = (input: OfficialDocumentInput) => {
    session.dispatch({ type: 'selectMode', mode: 'create' });
    session.dispatch({ type: 'updateCreatePurpose', purpose: input.purpose });
    session.dispatch({ type: 'updateCreateWorkArea', workArea: input.workArea });
    fields.forEach(field => session.dispatch({ type: 'updateCreate', field, value: input[field] }));
    session.dispatch({ type: 'setDraft', draft: generateOfficialDocumentDraft(input) });
    setPendingDraft(null); setDocumentOpen(true);
  };
  const saved: { readonly candidate: AiVideoCandidate; readonly conditions: SearchConditions; readonly recommendationReason?: RecommendationReason }[] = library.entries.flatMap(entry => {
    const candidate = entry.ai ?? (entry.candidateRecord ? candidateFromRecord(entry.videoId, entry.candidateRecord) : null);
    return candidate ? [{ candidate, conditions: { topic: entry.teacher.educationTitle, target: entry.teacher.target, minutes: null, publicFirst: true }, recommendationReason: entry.recommendationReason }] : [];
  });
  if (!saved.some(item => item.candidate.videoId === syntheticCandidate.videoId)) saved.unshift({ candidate: syntheticCandidate, conditions: syntheticConditions, recommendationReason: undefined });
  return <>
    <p className="aiv-status" role="status" aria-live="polite">{notice}</p>
    {documentOpen ? <>
      <button className="aiv-navigation" type="button" onClick={() => setDocumentOpen(false)}>QA Finder로 돌아가기</button>
      <OfficialDocumentPanel onClose={() => setDocumentOpen(false)} onNotice={setNotice}
        onOpenAiSettings={() => setNotice('격리 QA에서는 AI 연결을 사용할 수 없습니다.')}
        onSendSummaryToQuickAdd={() => setNotice('격리 QA에서는 외부 전송·동기화를 사용할 수 없습니다.')} />
    </> : <>
      <AiVideoFinder connection={finderQaConnection} enableLiveSearch={false}
        onClose={() => setNotice('이 화면은 운영 Dashboard와 분리된 QA 진입점입니다.')}
        onOpenSettings={() => setNotice('격리 QA에서는 인증·모델 조회·AI 연결이 차단됩니다.')}
        onOpenUrl={blocked}
        onSave={async (candidate, conditions, reason) => loaded(await saveAiCandidate(libraryRepository, candidate,
          { educationTitle: conditions.topic, target: conditions.target, schedule: '', instructions: '' }, reason))}
        onDraft={input => {
          if (!input.mainContent.split('\n').some(line => line.replace(/^\d+\.\s/u, '') === syntheticCandidate.url)) { setNotice('격리 QA에서는 QAoffline01 합성 후보만 기안에 사용할 수 있습니다.'); return; }
          const empty = createEmptyOfficialDocumentInput();
          const existing = session.state.draft !== null || fields.some(field => session.state.createInput[field] !== empty[field])
            || session.state.outputs.create.aiResponse !== '' || session.state.outputs.create.prompt !== '';
          if (existing) setPendingDraft(input); else applyDraft(input);
        }} saved={saved} />
      <LibraryTools library={library} onLoaded={loaded} onNotice={setNotice} />
    </>}
    {pendingDraft && <AiVideoDraftConfirmation onCancel={() => setPendingDraft(null)} onConfirm={() => applyDraft(pendingDraft)} />}
  </>;
}
