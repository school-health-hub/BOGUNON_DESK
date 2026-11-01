import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PurchaseHelperPanel } from '../../src/components/desktop/PurchaseHelperPanel';
import { usePurchaseItemEditing } from '../../src/purchase/usePurchaseItemEditing';
import { purchaseItemEditingReducer, type PurchaseEditingState, type PurchaseItemAction } from '../../src/purchase/purchaseItemEditing';
import { defaultPurchaseOutputColumns, type PurchaseDraft, type PurchaseOutputColumnId, type PurchaseSettlement } from '../../src/purchase/types';
import { syntheticItems } from './fixtures';
import type { PurchaseQaController } from './contract';
import { createPurchaseImportSession } from '../../src/purchase/purchaseImportSession';
import { loadMappingFixtures } from './mapping-fixtures';
import { configureMappingTransport, mappingTransportState, settleMappingTransport } from './mapping-transport';
import { usePurchaseImportResults } from '../../src/purchase/usePurchaseImportResults';
import type { PurchaseImportTemplate } from '../../src/purchase/types';
import '../../src/styles/base.css';
import '../../src/styles/dashboard.css';
import '../../src/styles/components.css';
import '../../src/styles/release-ui.css';
import '../../src/styles/desktop-workspace.css';

const mappingFixtures = await loadMappingFixtures();
configureMappingTransport(mappingFixtures);
if (location.hostname !== '127.0.0.1') throw new Error('QA entry requires isolated loopback server');
const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('Missing QA root');

function Owner({ count, restart }: { readonly count: number; readonly restart: (count: number) => void }) {
  const [open, setOpen] = useState(true);
  const [owned, dispatch] = usePurchaseItemEditing(open);
  // Fault injection is intentionally confined to this QA entry. Transactions still use the product reducer.
  const [fault, setFault] = useState<PurchaseEditingState | null>(null);
  const editing = fault ?? owned;
  const [draft, setDraft] = useState<PurchaseDraft | null>(null);
  const [settlement, setSettlement] = useState<PurchaseSettlement | null>(null);
  const [columns, setColumns] = useState<readonly PurchaseOutputColumnId[]>(defaultPurchaseOutputColumns);
  const [notice, setNotice] = useState('');
  const [session] = useState(createPurchaseImportSession);
  const [templates, setTemplates] = useState<readonly PurchaseImportTemplate[]>([]);
  const seedMapping = (kind: keyof typeof mappingFixtures) => {
    session.invalidate();
    const fixture = mappingFixtures[kind];
    setCandidates([fixture.candidate]);
    setSources([{ sourceName: fixture.candidate.sourceName, status: 'needsMapping', rowCount: 0, message: '합성 Rust 분석 결과: 열 확인 필요', candidateId: fixture.candidate.id, recognition: fixture.candidate.headerOptions[0]?.recommendation }]);
    setNotice('');
  };
  const sequence = useRef(100);
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current) { seeded.current = true; dispatch({ type: 'append', items: syntheticItems(count) }); }
  }, [count, dispatch]);
  const edit = (action: PurchaseItemAction) => {
    if (fault === null) dispatch(action);
    else setFault((current) => current === null ? current : purchaseItemEditingReducer(current, action));
  };
  const { sources, candidates, setSources, setCandidates, append: acceptAnalysis } = usePurchaseImportResults(items => edit({ type: 'append', items }));
  const append = () => {
    const row = syntheticItems(1)[0];
    if (row === undefined) throw new Error('Missing synthetic row');
    edit({ type: 'append', items: [{ ...row, id: `qa-extra-${sequence.current++}` }] });
  };
  useLayoutEffect(() => {
    const controller: PurchaseQaController = {
      getState: () => ({ ...editing, panelOpen: open, faultInjection: fault !== null, mapping: { sources, candidates, templates, notice }, requests: mappingTransportState() }),
      fixture: kind => mappingFixtures[kind],
      complete: settleMappingTransport,
      act: (action) => {
        switch (action) {
          case 'mapping:review': seedMapping('review'); break;
          case 'mapping:manual': seedMapping('manual'); break;
          case 'mapping:automatic': seedMapping('automatic'); break;
          case 'mapping:unrelated': {
            const candidate = mappingFixtures.manual.candidate;
            setCandidates(current => [...current, candidate]);
            setSources(current => [...current, { sourceName: candidate.sourceName, status: 'needsMapping', rowCount: 0, message: '합성 병행 상태', candidateId: candidate.id }]);
            const first = editing.items[0];
            if (first !== undefined) edit({ type: 'patch', id: first.id, patch: { vendor: '병행 수정 보존' } });
            break;
          }
          case 'mapping:new-request': session.begin(); break;
          case 'reset': session.invalidate(); restart(3); break;
          case 'many': restart(30); break;
          case 'append': case 'import': case 'add': case 'stale-import': append(); break;
          case 'replace': edit({ type: 'replace', items: syntheticItems(3) }); break;
          case 'close': session.invalidate(); setOpen(false); break;
          case 'open': setOpen(true); break;
          case 'corrupt-value': setFault({ ...editing, items: editing.items.map((item, index) => index === 1 ? { ...item, vendor: '합성 충돌 값' } : item) }); break;
          case 'corrupt-id': setFault({ ...editing, items: editing.items.slice(1) }); break;
          case 'corrupt-duplicate': {
            const first = editing.items[0];
            if (first === undefined) throw new Error('No row to duplicate');
            setFault({ ...editing, items: [...editing.items, first] }); break;
          }
          default: throw new Error(`Unsupported QA control: ${action}`);
        }
      },
    };
    window.purchaseQa = controller;
  });
  return <>
    <p aria-label="QA 범위">합성 데이터 전용 · 실제 제품 패널 · 네이티브 IPC 미실행</p>
    <output aria-label="QA 알림">{notice}</output>
    {open && <PurchaseHelperPanel importSession={session} editing={editing} columns={columns} draft={draft} settlement={settlement}
      sources={sources} candidates={candidates} templates={templates} draftTemplates={[]}
      onEdit={edit} onAddItem={append} onAnalysis={acceptAnalysis}
      onClose={() => { session.invalidate(); setOpen(false); }} onNotice={setNotice} onColumnsChange={setColumns}
      onDraftChange={setDraft} onSettlementChange={setSettlement}
      onCandidatesChange={setCandidates} onSourcesChange={setSources}
      onTemplatesChange={setTemplates} onDraftTemplatesChange={() => undefined} />}
  </>;
}
function App() {
  const [session, setSession] = useState({ key: 0, count: 3 });
  return <Owner key={session.key} count={session.count} restart={(count) => setSession((current) => ({ key: current.key + 1, count }))} />;
}
createRoot(rootElement).render(<App />);
