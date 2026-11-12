// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { P0App } from "../renderer/P0App";
import { WorkspaceBoundary } from "../renderer/WorkspaceBoundary";

const newsletterLifecycle = vi.hoisted(() => ({ mounts: 0 }));
const finderLifecycle = vi.hoisted(() => ({ mounts: 0, cancels: 0, savedMemo: "" }));
const inventoryLifecycle = vi.hoisted(() => ({ mounts: 0, savedName: "합성 저장 물품" }));
const schoolLifecycle = vi.hoisted(() => ({ mounts: 0, closes: 0 }));

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
vi.mock("../renderer/school-profile/SchoolProfile", () => ({
  SchoolProfileProvider: ({ children }: { readonly children: ReactNode }) => <>{children}</>,
  SchoolInitialSetup: ({ onOpenSchoolSettings }: { readonly onOpenSchoolSettings: () => void }) => <button type="button" onClick={onOpenSchoolSettings}>학교 설정 열기</button>,
  AccountSettings: () => null,
  SchoolConnectionSettings: () => <ol aria-label="학교 연결 단계" />,
  SchoolProfileSettings: () => null,
}));
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
  cleanup();
  vi.unstubAllGlobals();
  newsletterLifecycle.mounts = 0;
  finderLifecycle.mounts = 0;
  finderLifecycle.cancels = 0;
  finderLifecycle.savedMemo = "";
  inventoryLifecycle.mounts = 0;
  inventoryLifecycle.savedName = "합성 저장 물품";
  schoolLifecycle.mounts = 0;
  schoolLifecycle.closes = 0;
});

function setupDashboard(): void {
  vi.stubGlobal("ResizeObserver", class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  });
  vi.stubGlobal("electronP0", {
    info: async () => ({ appId: "kr.sungandi.schoolhealthdesk.electronp0", userData: "/synthetic-profile" }),
    readSettings: async () => null,
    writeSettings: vi.fn(async () => undefined),
  });
  vi.stubGlobal("electronWork", {
    memo: { read: async () => ({ ok: true, data: { version: 1, text: "" } }), write: vi.fn() },
    tasks: {
      load: async () => ({ ok: true, data: { document: { version: 1, revision: 0, tasks: [] }, recovered: false } }),
      save: vi.fn(),
    },
    educationVideo: { compat: undefined, searchProvider: undefined },
  });
}

it("keeps Newsletter mounted while its workspace is closed and reopened", async () => {
  // Given: the current P0 dashboard and its existing Settings handoff into Newsletter.
  setupDashboard();
  render(<P0App />);
  fireEvent.click(within(await screen.findByRole("navigation", { name: "주요 작업 공간" })).getByRole("button", { name: "설정" }));
  fireEvent.click(screen.getByRole("button", { name: "앱 정보" }));

  // When: Newsletter is opened, closed, and opened again through the same current entry path.
  fireEvent.click(screen.getByRole("button", { name: /보건소식지 제작소/ }));
  expect(await screen.findByRole("heading", { name: "합성 소식지 1" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "소식지 닫기" }));
  fireEvent.click(within(await screen.findByRole("navigation", { name: "주요 작업 공간" })).getByRole("button", { name: "설정" }));
  fireEvent.click(screen.getByRole("button", { name: "앱 정보" }));
  fireEvent.click(screen.getByRole("button", { name: /보건소식지 제작소/ }));

  // Then: the original component instance is revealed rather than remounted.
  expect(await screen.findByRole("heading", { name: "합성 소식지 1" })).toBeTruthy();
  expect(newsletterLifecycle.mounts).toBe(1);
});

it("hosts one Newsletter instance in the App Shell and preserves its edit across category navigation", async () => {
  setupDashboard();
  render(<P0App />);
  const rail = await screen.findByRole("navigation", { name: "주요 작업 공간" });

  fireEvent.click(within(rail).getByRole("button", { name: "문서·교육자료" }));
  fireEvent.click(screen.getByRole("button", { name: /보건소식지 제작소/ }));
  expect(await screen.findByText("문서·교육자료 / 보건소식지 제작소")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("합성 소식지 원고"), { target: { value: "유지할 합성 소식지 원고" } });

  fireEvent.click(within(rail).getByRole("button", { name: "홈" }));
  expect(within(rail).getByRole("button", { name: "홈" }).getAttribute("aria-current")).toBe("page");
  expect(screen.queryByRole("main", { name: "합성 보건소식지 제작소" })).toBeNull();

  fireEvent.click(within(rail).getByRole("button", { name: "문서·교육자료" }));
  fireEvent.click(screen.getByRole("button", { name: /보건소식지 제작소/ }));
  expect((await screen.findByLabelText("합성 소식지 원고") as HTMLInputElement).value).toBe("유지할 합성 소식지 원고");
  expect(newsletterLifecycle.mounts).toBe(1);

  fireEvent.click(screen.getByRole("button", { name: "소식지 닫기" }));
  expect(await screen.findByRole("heading", { name: "문서·교육자료" })).toBeTruthy();
});

it.each(["합성 생성 작업 전환", "합성 프로젝트 작업 전환"])("rejects Rail navigation while Newsletter is busy through %s", async (busyControl) => {
  setupDashboard();
  render(<P0App />);
  const rail = await screen.findByRole("navigation", { name: "주요 작업 공간" });
  fireEvent.click(within(rail).getByRole("button", { name: "문서·교육자료" }));
  fireEvent.click(screen.getByRole("button", { name: /보건소식지 제작소/ }));
  fireEvent.change(await screen.findByLabelText("합성 소식지 원고"), { target: { value: "작업 중 유지할 원고" } });
  fireEvent.click(screen.getByRole("button", { name: busyControl }));

  fireEvent.click(within(rail).getByRole("button", { name: "홈" }));

  expect(within(rail).getByRole("button", { name: "문서·교육자료" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("main", { name: "합성 보건소식지 제작소" })).toBeTruthy();
  expect((screen.getByLabelText("합성 소식지 원고") as HTMLInputElement).value).toBe("작업 중 유지할 원고");
  expect(newsletterLifecycle.mounts).toBe(1);

  fireEvent.click(screen.getByRole("button", { name: busyControl }));
  fireEvent.click(within(rail).getByRole("button", { name: "홈" }));
  expect(within(rail).getByRole("button", { name: "홈" }).getAttribute("aria-current")).toBe("page");
  expect(screen.queryByRole("main", { name: "합성 보건소식지 제작소" })).toBeNull();
});

it("keeps a failed SCHOOL workspace inside its independent error boundary", () => {
  // Given: a SCHOOL child that fails before shared data can render.
  const close = vi.fn();
  const reactError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const BrokenSchool = (): ReactNode => {
    throw new TypeError("synthetic SCHOOL failure");
  };

  // When: the current SCHOOL boundary catches the failure.
  render(<WorkspaceBoundary onClose={close}><BrokenSchool /></WorkspaceBoundary>);
  fireEvent.click(screen.getByRole("button", { name: "개인 업무로 돌아가기" }));

  // Then: shared content is not exposed and the existing personal-work return path is used.
  expect(screen.getByRole("alert").textContent).toContain("개인 업무는 계속 사용할 수 있습니다");
  expect(close).toHaveBeenCalledOnce();
  expect(reactError).toHaveBeenCalled();
  reactError.mockRestore();
});

it("hosts SCHOOL WORKSPACE in the school App Shell outlet through its existing owner", async () => {
  setupDashboard();
  render(<P0App />);
  const rail = await screen.findByRole("navigation", { name: "주요 작업 공간" });

  fireEvent.click(within(rail).getByRole("button", { name: "학교" }));
  fireEvent.click(screen.getByRole("button", { name: /학교 공동 공간/ }));

  expect(await screen.findByRole("main", { name: "합성 SCHOOL WORKSPACE" })).toBeTruthy();
  expect(screen.getByText("학교 / 학교 공동 공간")).toBeTruthy();
  expect(within(rail).getByRole("button", { name: "학교" }).getAttribute("aria-current")).toBe("page");
  expect(screen.queryByRole("dialog", { name: "우리 보건실" })).toBeNull();
  expect(schoolLifecycle.mounts).toBe(1);

  fireEvent.click(screen.getByRole("button", { name: "학교 목록으로" }));
  expect(await screen.findByRole("heading", { name: "학교" })).toBeTruthy();
  expect(schoolLifecycle.closes).toBe(1);
});

it("leaves and re-enters SCHOOL without inventing a persistent renderer session", async () => {
  setupDashboard();
  render(<P0App />);
  const rail = await screen.findByRole("navigation", { name: "주요 작업 공간" });

  fireEvent.click(within(rail).getByRole("button", { name: "학교" }));
  fireEvent.click(screen.getByRole("button", { name: /학교 공동 공간/ }));
  expect(await screen.findByRole("main", { name: "합성 SCHOOL WORKSPACE" })).toBeTruthy();

  fireEvent.click(within(rail).getByRole("button", { name: "홈" }));
  expect(await screen.findByText("합성 Home")).toBeTruthy();
  expect(within(rail).getByRole("button", { name: "홈" }).getAttribute("aria-current")).toBe("page");

  fireEvent.click(within(rail).getByRole("button", { name: "학교" }));
  fireEvent.click(screen.getByRole("button", { name: /학교 공동 공간/ }));
  expect(await screen.findByRole("heading", { name: "합성 학교 공동 공간 2" })).toBeTruthy();
  expect(schoolLifecycle.mounts).toBe(2);
});

it("keeps local School settings separate from the shared SCHOOL owner", async () => {
  setupDashboard();
  render(<P0App />);
  const rail = await screen.findByRole("navigation", { name: "주요 작업 공간" });

  fireEvent.click(within(rail).getByRole("button", { name: "학교" }));
  fireEvent.click(screen.getByRole("button", { name: /학교 연결/ }));

  expect(screen.getByRole("heading", { name: "학교·연결" })).toBeTruthy();
  expect(screen.getByRole("list", { name: "학교 연결 단계" })).toBeTruthy();
  expect(screen.queryByRole("main", { name: "합성 SCHOOL WORKSPACE" })).toBeNull();
  expect(schoolLifecycle.mounts).toBe(0);
});

it("opens Finance from its approved schedule category through the existing owner", async () => {
  // Given: the App Shell is mounted over the current P0 lifecycle owners.
  setupDashboard();
  render(<P0App />);

  // When: Finance is launched from 일정·업무 instead of the legacy toolbox.
  const rail = await screen.findByRole("navigation", { name: "주요 작업 공간" });
  fireEvent.click(within(rail).getByRole("button", { name: "일정·업무" }));
  fireEvent.click(screen.getByRole("button", { name: /MY FINANCE/ }));

  // Then: P0App's existing Finance owner opens and closes the workspace.
  expect(await screen.findByRole("heading", { name: "합성 MY FINANCE" })).toBeTruthy();
  expect(screen.getByRole("main").getAttribute("data-embedded")).toBe("true");
  expect(screen.getByText("일정·업무 / MY FINANCE")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Finance 닫기" }));
  expect(await screen.findByRole("button", { name: /MY FINANCE/ })).toBeTruthy();
});

it("keeps Finance and its draft active when Rail navigation is cancelled", async () => {
  setupDashboard();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<P0App />);
  const rail = await screen.findByRole("navigation", { name: "주요 작업 공간" });
  fireEvent.click(within(rail).getByRole("button", { name: "일정·업무" }));
  fireEvent.click(screen.getByRole("button", { name: /MY FINANCE/ }));
  fireEvent.change(await screen.findByLabelText("합성 Finance 초안"), { target: { value: "합성 미저장 초안" } });

  fireEvent.click(within(rail).getByRole("button", { name: "문서·교육자료" }));

  expect(confirm).toHaveBeenCalledOnce();
  expect(screen.getByRole("heading", { name: "합성 MY FINANCE" })).toBeTruthy();
  expect(screen.getByLabelText("합성 Finance 초안")).toHaveProperty("value", "합성 미저장 초안");
  expect(within(rail).getByRole("button", { name: "일정·업무" }).getAttribute("aria-current")).toBe("page");
  confirm.mockRestore();
});

it("guards Rail navigation while the Home layout editor owns an unfinished edit", async () => {
  setupDashboard();
  render(<P0App />);
  fireEvent.click(await screen.findByRole("button", { name: "화면 꾸미기" }));

  const rail = screen.getByRole("navigation", { name: "주요 작업 공간" });
  fireEvent.click(within(rail).getByRole("button", { name: "일정·업무" }));

  expect(within(rail).getByRole("button", { name: "홈" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByText(/화면 꾸미기를 먼저 완료/)).toBeTruthy();
});

it("returns Rail, header, and Dock ownership to Home from the unified Settings workspace", async () => {
  setupDashboard();
  render(<P0App />);

  const rail = await screen.findByRole("navigation", { name: "주요 작업 공간" });
  fireEvent.click(within(rail).getByRole("button", { name: "설정" }));
  expect(within(rail).getByRole("button", { name: "설정" }).getAttribute("aria-current")).toBe("page");

  fireEvent.click(within(rail).getByRole("button", { name: "홈" }));

  expect(within(rail).getByRole("button", { name: "홈" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByText("현재 위치").nextElementSibling?.textContent).toBe("홈");
  expect(within(screen.getByRole("navigation", { name: "주요 기능" })).getByRole("button", { name: "홈" }).getAttribute("aria-current")).toBe("page");
});

it("routes Settings and School connection entries to their matching unified sections", async () => {
  setupDashboard();
  render(<P0App />);

  const rail = await screen.findByRole("navigation", { name: "주요 작업 공간" });
  fireEvent.click(within(rail).getByRole("button", { name: "설정" }));
  expect(screen.getByRole("heading", { name: "계정" })).toBeTruthy();

  fireEvent.click(within(rail).getByRole("button", { name: "학교" }));
  fireEvent.click(screen.getByRole("button", { name: /학교 연결/ }));
  expect(screen.getByRole("heading", { name: "학교·연결" })).toBeTruthy();
  expect(screen.getByRole("list", { name: "학교 연결 단계" })).toBeTruthy();
});

it("routes the unconfigured startup guide into the School settings workspace without opening a second setup surface", async () => {
  setupDashboard();
  render(<P0App />);

  fireEvent.click(await screen.findByRole("button", { name: "학교 설정 열기" }));

  const rail = screen.getByRole("navigation", { name: "주요 작업 공간" });
  expect(within(rail).getByRole("button", { name: "설정" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("heading", { name: "학교·연결" })).toBeTruthy();
  expect(screen.getByRole("list", { name: "학교 연결 단계" })).toBeTruthy();
});

it("keeps the Official draft in the App Shell when Rail navigation discard is cancelled", async () => {
  setupDashboard();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<P0App />);

  const rail = await screen.findByRole("navigation", { name: "주요 작업 공간" });
  fireEvent.click(within(rail).getByRole("button", { name: "문서·교육자료" }));
  fireEvent.click(screen.getByRole("button", { name: /공문작업실/ }));
  fireEvent.change(await screen.findByLabelText("합성 공문 원고"), { target: { value: "보호할 합성 원고" } });
  fireEvent.click(within(rail).getByRole("button", { name: "홈" }));

  expect(confirm).toHaveBeenCalledOnce();
  expect((screen.getByLabelText("합성 공문 원고") as HTMLInputElement).value).toBe("보호할 합성 원고");
  expect(within(rail).getByRole("button", { name: "문서·교육자료" }).getAttribute("aria-current")).toBe("page");

  confirm.mockReturnValue(true);
  fireEvent.click(within(rail).getByRole("button", { name: "홈" }));
  expect(await screen.findByText("합성 Home")).toBeTruthy();
  expect(within(rail).getByRole("button", { name: "홈" }).getAttribute("aria-current")).toBe("page");
});

it("keeps the Purchase session mounted when Rail navigation closes its App Shell presentation", async () => {
  setupDashboard();
  const confirm = vi.spyOn(window, "confirm");
  render(<P0App />);

  const rail = await screen.findByRole("navigation", { name: "주요 작업 공간" });
  fireEvent.click(within(rail).getByRole("button", { name: "물품·품의" }));
  fireEvent.click(screen.getByRole("button", { name: /품의 도우미/ }));
  expect(screen.getByRole("main", { name: "합성 품의 도우미" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("합성 품의 원고"), { target: { value: "유지할 합성 품의 원고" } });

  fireEvent.click(within(rail).getByRole("button", { name: "홈" }));
  expect(confirm).not.toHaveBeenCalled();
  expect(within(rail).getByRole("button", { name: "홈" }).getAttribute("aria-current")).toBe("page");

  fireEvent.click(within(rail).getByRole("button", { name: "물품·품의" }));
  fireEvent.click(screen.getByRole("button", { name: /품의 도우미/ }));
  expect((screen.getByLabelText("합성 품의 원고") as HTMLInputElement).value).toBe("유지할 합성 품의 원고");
  fireEvent.click(screen.getByRole("button", { name: "품의 목록으로 돌아가기" }));
  expect(screen.getByRole("button", { name: /품의 도우미/ })).toBeTruthy();
});

it("keeps Purchase and its modal open when a Rail transition is guarded", async () => {
  setupDashboard();
  render(<P0App />);

  const rail = await screen.findByRole("navigation", { name: "주요 작업 공간" });
  fireEvent.click(within(rail).getByRole("button", { name: "물품·품의" }));
  fireEvent.click(screen.getByRole("button", { name: /품의 도우미/ }));
  fireEvent.change(screen.getByLabelText("합성 품의 원고"), { target: { value: "보호할 합성 원고" } });
  fireEvent.click(screen.getByRole("button", { name: "합성 출력 모달 열기" }));

  fireEvent.click(within(rail).getByRole("button", { name: "홈" }));

  expect(screen.getByRole("dialog", { name: "합성 품의 출력 모달" })).toBeTruthy();
  expect((screen.getByLabelText("합성 품의 원고") as HTMLInputElement).value).toBe("보호할 합성 원고");
  expect(within(rail).getByRole("button", { name: "물품·품의" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByText(/현재 작업 화면을 먼저 닫아 주세요/)).toBeTruthy();
});

it("unmounts Finder on navigation and reloads only its persisted library state on re-entry", async () => {
  setupDashboard();
  const confirm = vi.spyOn(window, "confirm");
  render(<P0App />);

  const rail = await screen.findByRole("navigation", { name: "주요 작업 공간" });
  fireEvent.click(within(rail).getByRole("button", { name: "문서·교육자료" }));
  fireEvent.click(screen.getByRole("button", { name: /교육영상 Finder/ }));

  expect(screen.getByText("문서·교육자료 / 교육영상 Finder")).toBeTruthy();
  expect((await screen.findByRole("region", { name: "합성 교육영상 Finder" })).getAttribute("data-embedded")).toBe("true");
  fireEvent.change(screen.getByLabelText("합성 검색어"), { target: { value: "재진입하면 지울 검색" } });
  fireEvent.change(screen.getByLabelText("합성 저장 메모"), { target: { value: "저장된 합성 메모" } });
  fireEvent.click(screen.getByRole("button", { name: "합성 메모 저장" }));

  fireEvent.click(within(rail).getByRole("button", { name: "홈" }));
  expect(confirm).not.toHaveBeenCalled();
  expect(finderLifecycle.cancels).toBe(1);
  expect(screen.queryByRole("region", { name: "합성 교육영상 Finder" })).toBeNull();

  fireEvent.click(within(rail).getByRole("button", { name: "문서·교육자료" }));
  fireEvent.click(screen.getByRole("button", { name: /교육영상 Finder/ }));
  await screen.findByRole("region", { name: "합성 교육영상 Finder" });
  expect(finderLifecycle.mounts).toBe(2);
  expect((screen.getByLabelText("합성 검색어") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("합성 저장 메모") as HTMLInputElement).value).toBe("저장된 합성 메모");

  fireEvent.click(screen.getByRole("button", { name: "문서·교육자료로" }));
  expect(screen.getByRole("button", { name: /교육영상 Finder/ })).toBeTruthy();
  expect(finderLifecycle.cancels).toBe(2);
});

it("hosts Inventory in the App Shell and preserves its existing leave and persisted re-entry contract", async () => {
  setupDashboard();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<P0App />);

  const rail = await screen.findByRole("navigation", { name: "주요 작업 공간" });
  fireEvent.click(within(rail).getByRole("button", { name: "물품·품의" }));
  fireEvent.click(screen.getByRole("button", { name: /개인 Inventory/ }));
  expect(screen.getByText("물품·품의 / 물품관리")).toBeTruthy();
  expect((await screen.findByRole("region", { name: "합성 개인 Inventory" })).getAttribute("data-embedded")).toBe("true");
  fireEvent.change(screen.getByLabelText("합성 물품 검색"), { target: { value: "재진입하면 지울 검색" } });
  fireEvent.change(screen.getByLabelText("합성 물품 편집"), { target: { value: "저장 전 합성 물품" } });

  fireEvent.click(within(rail).getByRole("button", { name: "홈" }));
  expect(confirm).toHaveBeenCalledOnce();
  expect((screen.getByLabelText("합성 물품 편집") as HTMLInputElement).value).toBe("저장 전 합성 물품");
  expect(within(rail).getByRole("button", { name: "물품·품의" }).getAttribute("aria-current")).toBe("page");

  fireEvent.click(screen.getByRole("button", { name: "합성 물품 저장" }));
  confirm.mockReturnValue(true);
  fireEvent.click(within(rail).getByRole("button", { name: "홈" }));
  expect(screen.queryByRole("region", { name: "합성 개인 Inventory" })).toBeNull();

  fireEvent.click(within(rail).getByRole("button", { name: "물품·품의" }));
  fireEvent.click(screen.getByRole("button", { name: /개인 Inventory/ }));
  expect(inventoryLifecycle.mounts).toBe(2);
  expect((screen.getByLabelText("합성 물품 검색") as HTMLInputElement).value).toBe("");
  expect(screen.getByText("저장 전 합성 물품")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "물품·품의로" }));
  expect(screen.getByRole("button", { name: /개인 Inventory/ })).toBeTruthy();
});
