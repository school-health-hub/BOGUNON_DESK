import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PurchaseHelperPanel } from '../../src/components/desktop/PurchaseHelperPanel';
import { usePurchaseItemEditing } from '../../src/purchase/usePurchaseItemEditing';
import { purchaseItemEditingReducer, type PurchaseEditingState, type PurchaseItemAction } from '../../src/purchase/purchaseItemEditing';
import { defaultPurchaseOutputColumns, type PurchaseDraft, type PurchaseOutputColumnId, type PurchaseSettlement } from '../../src/purchase/types';
import { syntheticItems } from './fixtures';
import type { PurchaseQaController } from './contract';
import '../../src/styles/base.css';
import '../../src/styles/dashboard.css';
import '../../src/styles/components.css';
import '../../src/styles/release-ui.css';
import '../../src/styles/desktop-workspace.css';

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
  const sequence = useRef(100);
  const seeded = useRef(false);
  useEffect(() => {
    if (!seeded.current) { seeded.current = true; dispatch({ type: 'append', items: syntheticItems(count) }); }
  }, [count, dispatch]);
  const edit = (action: PurchaseItemAction) => {
    if (fault === null) dispatch(action);
    else setFault((current) => current === null ? current : purchaseItemEditingReducer(current, action));
  };
  const append = () => {
    const row = syntheticItems(1)[0];
    if (row === undefined) throw new Error('Missing synthetic row');
    edit({ type: 'append', items: [{ ...row, id: `qa-extra-${sequence.current++}` }] });
  };
  useLayoutEffect(() => {
    const controller: PurchaseQaController = {
      getState: () => ({ ...editing, panelOpen: open, faultInjection: fault !== null }),
      act: (action) => {
        switch (action) {
          case 'reset': restart(3); break;
          case 'many': restart(30); break;
          case 'append': case 'import': case 'add': case 'stale-import': append(); break;
          case 'replace': edit({ type: 'replace', items: syntheticItems(3) }); break;
          case 'close': setOpen(false); break;
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
    {open && <PurchaseHelperPanel editing={editing} columns={columns} draft={draft} settlement={settlement}
      sources={[]} candidates={[]} templates={[]} draftTemplates={[]}
      onEdit={edit} onAddItem={append} onAnalysis={(result) => edit({ type: 'append', items: result.items })}
      onClose={() => setOpen(false)} onNotice={setNotice} onColumnsChange={setColumns}
      onDraftChange={setDraft} onSettlementChange={setSettlement}
      onCandidatesChange={() => undefined} onSourcesChange={() => undefined}
      onTemplatesChange={() => undefined} onDraftTemplatesChange={() => undefined} />}
  </>;
}
function App() {
  const [session, setSession] = useState({ key: 0, count: 3 });
  return <Owner key={session.key} count={session.count} restart={(count) => setSession((current) => ({ key: current.key + 1, count }))} />;
}
createRoot(rootElement).render(<App />);
