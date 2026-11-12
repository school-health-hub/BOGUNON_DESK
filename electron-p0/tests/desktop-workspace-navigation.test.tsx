// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { P0App } from "../renderer/P0App";
import type {DesktopEntry} from '../desktop-surface-protocol';

const newsletterLifecycle = vi.hoisted(() => ({ mounts: 0 }));
const finderLifecycle = vi.hoisted(() => ({ mounts: 0, cancels: 0, savedMemo: "" }));
const inventoryLifecycle = vi.hoisted(() => ({ mounts: 0, savedName: "합성 저장 물품" }));
const schoolLifecycle = vi.hoisted(() => ({ mounts: 0, closes: 0 }));
let workspaceCloseListener: ((request: { readonly id: number }) => void) | undefined;
const resolveWorkspaceClose = vi.fn();

vi.mock("../renderer/WorkspaceProductHost", async () => {
  const { useState } = await import("react");
  return { default: ({ onClose }: { readonly onClose: () => void }) => {
    const [instance] = useState(() => { schoolLifecycle.mounts += 1; return schoolLifecycle.mounts; });
    return <main aria-label="합성 SCHOOL WORKSPACE"><h1>{`합성 학교 공동 공간 ${instance}`}</h1><p>승인된 학교 역할을 확인합니다.</p><button type="button" onClick={() => { schoolLifecycle.closes += 1; onClose(); }}>학교 목록으로</button></main>;
  } };
});

vi.mock("../../src/newsletter/NewsletterStudio", async () => {
  const { useEffect, useRef, useState } = await import("react");
  return {
    NewsletterStudio: ({ onClose, closeRequest, onCloseRequestResolved }: { readonly onClose: () => void; readonly closeRequest?: number; readonly onCloseRequestResolved?: (closed: boolean) => void }) => {
      const [instance] = useState(() => {
        newsletterLifecycle.mounts += 1;
        return newsletterLifecycle.mounts;
      });
      const [draft, setDraft] = useState("");
      const [busy, setBusy] = useState(false);
      const [projectBusy, setProjectBusy] = useState(false);
      const previous = useRef(closeRequest);
      useEffect(() => {
        if (closeRequest === undefined || previous.current === closeRequest) return;
        previous.current = closeRequest;
        if (busy || projectBusy) { onCloseRequestResolved?.(false); return; }
        onClose(); onCloseRequestResolved?.(true);
      }, [busy, closeRequest, onClose, onCloseRequestResolved, projectBusy]);
      return <main aria-label="합성 보건소식지 제작소"><h1>{`합성 소식지 ${instance}`}</h1><label>합성 소식지 원고<input value={draft} onChange={event => setDraft(event.target.value)} /></label><button type="button" onClick={() => setBusy(value => !value)}>합성 생성 작업 전환</button><button type="button" onClick={() => setProjectBusy(value => !value)}>합성 프로젝트 작업 전환</button><button type="button" disabled={busy || projectBusy} onClick={onClose}>소식지 닫기</button></main>;
    },
  };
});
vi.mock("../renderer/purchase/PurchaseSession", async () => {
  const { useState } = await import("react");
  return { PurchaseSession: ({ open, onClose, embedded }: { readonly open: boolean; readonly onClose: () => void; readonly embedded?: boolean }) => {
    const [draft, setDraft] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    return <main hidden={!open} aria-label="합성 품의 도우미" data-embedded={String(embedded)}>
      <label>합성 품의 원고<input value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
      <button type="button" onClick={() => setModalOpen(true)}>합성 출력 모달 열기</button>
      {modalOpen && <section role="dialog" aria-modal="true" aria-label="합성 품의 출력 모달"><button type="button" onClick={() => setModalOpen(false)}>합성 출력 모달 닫기</button></section>}
      <button type="button" onClick={onClose}>품의 목록으로 돌아가기</button>
    </main>;
  } };
});
vi.mock("../../src/education-video/EducationVideoFinder", async () => {
  const { useEffect, useState } = await import("react");
  return { EducationVideoFinder: ({ onClose, embedded }: { readonly onClose: () => void; readonly embedded?: boolean }) => {
    const [instance] = useState(() => { finderLifecycle.mounts += 1; return finderLifecycle.mounts; });
    const [search, setSearch] = useState("");
    const [memo, setMemo] = useState(() => finderLifecycle.savedMemo);
    useEffect(() => () => { finderLifecycle.cancels += 1; }, []);
    return <section aria-label="합성 교육영상 Finder" data-embedded={String(embedded)}>
      <span>{`합성 Finder 인스턴스 ${instance}`}</span>
      <label>합성 검색어<input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label>합성 저장 메모<input value={memo} onChange={(event) => setMemo(event.target.value)} /></label>
      <button type="button" onClick={() => { finderLifecycle.savedMemo = memo; }}>합성 메모 저장</button>
      <button type="button" onClick={onClose}>문서·교육자료로</button>
    </section>;
  } };
});
vi.mock("../renderer/inventory-preview/InventoryHost", async () => {
  const { useEffect, useRef, useState } = await import("react");
  return { InventoryHost: ({ onClose, closeRequest, onCloseRequestResolved, embedded }: { readonly onClose: () => void; readonly closeRequest?: number; readonly onCloseRequestResolved?: (closed: boolean) => void; readonly embedded?: boolean }) => {
    const [instance] = useState(() => { inventoryLifecycle.mounts += 1; return inventoryLifecycle.mounts; });
    const [draft, setDraft] = useState("");
    const [query, setQuery] = useState("");
    const previous = useRef(closeRequest);
    useEffect(() => {
      if (closeRequest === undefined || previous.current === closeRequest) return;
      previous.current = closeRequest;
      if (draft && !window.confirm("저장하지 않은 입력을 버리시겠습니까?")) { onCloseRequestResolved?.(false); return; }
      onClose(); onCloseRequestResolved?.(true);
    }, [closeRequest, draft, onClose, onCloseRequestResolved]);
    return <section aria-label="합성 개인 Inventory" data-embedded={String(embedded)}>
      <span>{`합성 Inventory 인스턴스 ${instance}`}</span><span>{inventoryLifecycle.savedName}</span>
      <label>합성 물품 검색<input value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label>합성 물품 편집<input value={draft} onChange={event => setDraft(event.target.value)} /></label>
      <button type="button" onClick={() => { inventoryLifecycle.savedName = draft || inventoryLifecycle.savedName; setDraft(""); }}>합성 물품 저장</button>
      <button type="button" onClick={() => { if (!draft || window.confirm("저장하지 않은 입력을 버리시겠습니까?")) onClose(); }}>물품·품의로</button>
    </section>;
  } };
});
vi.mock("../../src/components/dashboard/DesktopWidgetLayout", () => ({ DesktopWidgetLayout: () => <div>합성 Home</div> }));
vi.mock("../renderer/finance/FinanceHost", async () => {
  const { useEffect, useRef, useState } = await import("react");
  return { FinanceHost: ({ embedded, closeRequest, onClose, onCloseRequestResolved }: { readonly embedded?: boolean; readonly closeRequest?: number; readonly onClose: () => void; readonly onCloseRequestResolved?: (closed: boolean) => void }) => {
    const [draft, setDraft] = useState("");
    const previous = useRef(closeRequest);
    useEffect(() => {
      if (closeRequest === undefined || previous.current === closeRequest) return;
      previous.current = closeRequest;
      if (draft && !window.confirm("합성 Finance 초안을 폐기할까요?")) { onCloseRequestResolved?.(false); return; }
      onClose(); onCloseRequestResolved?.(true);
    }, [closeRequest, draft, onClose, onCloseRequestResolved]);
    return <main data-embedded={String(embedded)}><h1>합성 MY FINANCE</h1><label>합성 Finance 초안<input value={draft} onChange={event => setDraft(event.target.value)} /></label><button type="button" onClick={onClose}>Finance 닫기</button></main>;
  } };
});
vi.mock("../../src/official-document/OfficialDocumentWorkspace", async () => {
  const { useEffect, useRef, useState } = await import("react");
  return { OfficialDocumentWorkspace: ({ closeRequest, onClose, onCloseRequestResolved }: { readonly closeRequest?: number; readonly onClose: () => void; readonly onCloseRequestResolved?: (closed: boolean) => void }) => {
    const [draft, setDraft] = useState("");
    const previous = useRef(closeRequest);
    useEffect(() => {
      if (closeRequest === undefined || previous.current === closeRequest) return;
      previous.current = closeRequest;
      if (draft && !window.confirm("합성 공문 초안을 폐기할까요?")) { onCloseRequestResolved?.(false); return; }
      onClose(); onCloseRequestResolved?.(true);
    }, [closeRequest, draft, onClose, onCloseRequestResolved]);
    return <main><h1>합성 공문작업실</h1><label>합성 공문 원고<input value={draft} onChange={event => setDraft(event.target.value)} /></label></main>;
  } };
});

afterEach(() => {
  cleanup();vi.restoreAllMocks();ready.mockReset();entryListener=undefined;
  vi.unstubAllGlobals();
  newsletterLifecycle.mounts = 0;
  finderLifecycle.mounts = 0;
  finderLifecycle.cancels = 0;
  finderLifecycle.savedMemo = "";
  inventoryLifecycle.mounts = 0;
  inventoryLifecycle.savedName = "합성 저장 물품";
  schoolLifecycle.mounts = 0;
  schoolLifecycle.closes = 0;
  workspaceCloseListener = undefined;
  resolveWorkspaceClose.mockReset();
});

let entryListener:((entry:DesktopEntry)=>void)|undefined;
const ready=vi.fn();
function send(moduleId: 'finance'|'newsletter'|'official-document'|'purchase-helper'):void {
  act(()=>entryListener?.({kind:'module',moduleId}));
}
function setupDashboard(freshSchool=false): void {
  vi.stubGlobal('electronSurfaceSettings',{read:async()=>({revision:0,value:null}),write:vi.fn(),subscribe:()=>()=>undefined});
  vi.stubGlobal('electronDesktopNavigation',{ready:async()=>{expect(entryListener).toBeTypeOf('function');ready();},onEntry:(listener:(entry:DesktopEntry)=>void)=>{entryListener=listener;return()=>{entryListener=undefined;};},openSettings:vi.fn(async()=>undefined)});
  vi.stubGlobal("ResizeObserver", class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  });
  vi.stubGlobal("electronP0", {
    info: async () => ({ appId: "kr.sungandi.schoolhealthdesk.electronp0", userData: "/synthetic-profile" }),
    readSettings: async () => null,
    writeSettings: vi.fn(async () => undefined),
    onWorkspaceCloseRequest: (listener: (request: { readonly id: number }) => void) => {
      workspaceCloseListener = listener;
      return () => { workspaceCloseListener = undefined; };
    },
    resolveWorkspaceClose: resolveWorkspaceClose,
  });
  vi.stubGlobal("electronWork", {
    school:freshSchool?{load:async()=>({ok:true,data:{document:{version:1,revision:0,school:null},recovered:false,bogunon:'unavailable'}}),cancel:async()=>({ok:true,data:null})}:undefined,
    memo: { read: async () => ({ ok: true, data: { version: 1, text: "" } }), write: vi.fn() },
    tasks: {
      load: async () => ({ ok: true, data: { document: { version: 1, revision: 0, tasks: [] }, recovered: false } }),
      save: vi.fn(),
    },
    educationVideo: { compat: undefined, searchProvider: undefined },
  });
}


it('retains dirty Finance after Desktop entry cancellation',async()=>{
  setupDashboard();vi.spyOn(window,'confirm').mockReturnValue(false);
  render(<P0App/>);await waitFor(()=>expect(ready).toHaveBeenCalled());
  send('finance');fireEvent.change(await screen.findByLabelText('합성 Finance 초안'),{target:{value:'합성 초안'}});
  send('newsletter');
  await waitFor(()=>expect(window.confirm).toHaveBeenCalled());
  expect(screen.getByDisplayValue('합성 초안')).toBeTruthy();
  expect(screen.queryByRole('main',{name:'합성 보건소식지 제작소'})).toBeNull();
});
it('refuses Desktop same-category navigation while Newsletter is busy',async()=>{
  setupDashboard();render(<P0App/>);await waitFor(()=>expect(entryListener).toBeTypeOf('function'));
  send('newsletter');fireEvent.click(await screen.findByRole('button',{name:'합성 생성 작업 전환'}));
  send('official-document');
  expect(screen.getByRole('main',{name:'합성 보건소식지 제작소'})).toBeTruthy();
  expect(screen.queryByRole('heading',{name:'합성 공문작업실'})).toBeNull();
});
it('routes after accepted Finance close and unmounts the previous owner',async()=>{
  setupDashboard();vi.spyOn(window,'confirm').mockReturnValue(true);
  render(<P0App/>);await waitFor(()=>expect(entryListener).toBeTypeOf('function'));
  send('finance');fireEvent.change(await screen.findByLabelText('합성 Finance 초안'),{target:{value:'합성 초안'}});
  send('newsletter');
  expect(await screen.findByRole('main',{name:'합성 보건소식지 제작소'})).toBeTruthy();
  expect(screen.queryByLabelText('합성 Finance 초안')).toBeNull();
});
it('does not replace a pending destination or duplicate the close request',async()=>{
  setupDashboard();const confirmation=vi.spyOn(window,'confirm').mockReturnValue(true);
  render(<P0App/>);await waitFor(()=>expect(entryListener).toBeTypeOf('function'));
  send('finance');fireEvent.change(await screen.findByLabelText('합성 Finance 초안'),{target:{value:'합성 초안'}});
  act(()=>{entryListener?.({kind:'module',moduleId:'newsletter'});entryListener?.({kind:'module',moduleId:'official-document'});});
  expect(await screen.findByRole('main',{name:'합성 보건소식지 제작소'})).toBeTruthy();
  expect(confirmation).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('heading',{name:'합성 공문작업실'})).toBeNull();
});

it('opens only the first Desktop module when two entries arrive before a render',async()=>{
  setupDashboard();render(<P0App/>);await waitFor(()=>expect(entryListener).toBeTypeOf('function'));
  act(()=>{entryListener?.({kind:'module',moduleId:'finance'});entryListener?.({kind:'module',moduleId:'newsletter'});});
  expect(await screen.findByLabelText('합성 Finance 초안')).toBeTruthy();
  expect(screen.queryByRole('main',{name:'합성 보건소식지 제작소'})).toBeNull();
});

it('rejects OS close while a Desktop owner transition is pending',async()=>{
  setupDashboard();render(<P0App/>);await waitFor(()=>expect(entryListener).toBeTypeOf('function'));
  send('finance');await screen.findByLabelText('합성 Finance 초안');
  act(()=>{entryListener?.({kind:'module',moduleId:'newsletter'});workspaceCloseListener?.({id:81});});
  expect(await screen.findByRole('main',{name:'합성 보건소식지 제작소'})).toBeTruthy();
  expect(resolveWorkspaceClose).toHaveBeenCalledWith({id:81,allow:false});
});
it('ignores Desktop entry while an OS close owns the existing guard',async()=>{
  setupDashboard();render(<P0App/>);await waitFor(()=>expect(entryListener).toBeTypeOf('function'));
  send('finance');await screen.findByLabelText('합성 Finance 초안');
  act(()=>{workspaceCloseListener?.({id:82});entryListener?.({kind:'module',moduleId:'newsletter'});});
  await waitFor(()=>expect(resolveWorkspaceClose).toHaveBeenCalledWith({id:82,allow:true}));
  expect(screen.queryByRole('main',{name:'합성 보건소식지 제작소'})).toBeNull();
});

it('opens the first Desktop module on a fresh school profile before Home onboarding',async()=>{
  setupDashboard(true);render(<P0App/>);
  await waitFor(()=>expect(entryListener).toBeTypeOf('function'));
  await act(async()=>{await Promise.resolve();});
  act(()=>entryListener?.({kind:'module',moduleId:'personal-inventory'}));
  expect(await screen.findByLabelText('합성 물품 검색')).toBeTruthy();
  expect(screen.queryByRole('dialog',{name:'학교 설정 안내'})).toBeNull();
});
it('retains school onboarding when the user explicitly enters Home',async()=>{
  setupDashboard(true);render(<P0App/>);
  const rail=await screen.findByRole('navigation',{name:'주요 작업 공간'});
  fireEvent.click(within(rail).getByRole('button',{name:'홈'}));
  expect(await screen.findByRole('dialog',{name:'학교 설정 안내'})).toBeTruthy();
});
