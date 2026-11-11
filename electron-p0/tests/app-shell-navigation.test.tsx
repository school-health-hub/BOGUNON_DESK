// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppShell } from "../renderer/AppShell";
import type { WorkspaceCategoryId, WorkspaceModuleId } from "../../src/navigation/workspaceRegistry";

afterEach(cleanup);

function Harness({ initial = "home", onOpenModule = () => undefined }: Readonly<{ initial?: WorkspaceCategoryId; onOpenModule?: (id: WorkspaceModuleId) => void }>) {
  const [activeCategory, setActiveCategory] = useState<WorkspaceCategoryId>(initial);
  return <AppShell activeCategory={activeCategory} onCategoryChange={setActiveCategory} onOpenModule={onOpenModule}><p>합성 Home</p></AppShell>;
}

it("renders the approved category rail and opens a category workspace", () => {
  const openModule = vi.fn();
  render(<Harness onOpenModule={openModule} />);

  expect(screen.getAllByRole("button", { name: /^(홈|일정·업무|문서·교육자료|물품·품의|학교|설정)$/ }).map((button) => button.textContent)).toEqual([
    "홈", "일정·업무", "문서·교육자료", "물품·품의", "학교", "설정",
  ]);
  fireEvent.click(screen.getByRole("button", { name: "문서·교육자료" }));
  expect(screen.getByRole("heading", { name: "문서·교육자료" })).toBeTruthy();
  expect(screen.getByRole("button", { name: /생기부 도우미/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /교육영상 Finder/ })).toBeTruthy();
});

it("keeps Finance under schedule work and routes module activation through one callback", () => {
  const openModule = vi.fn();
  render(<Harness initial="schedule-work" onOpenModule={openModule} />);

  const finance = screen.getByRole("button", { name: /MY FINANCE/ });
  fireEvent.click(finance);
  expect(openModule).toHaveBeenCalledWith("finance");
});

it("supports arrow-key rail movement and announces the active location", () => {
  render(<Harness />);
  const home = screen.getByRole("button", { name: "홈" });
  home.focus();
  fireEvent.keyDown(home, { key: "ArrowDown" });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "일정·업무" }));
  expect(home.getAttribute("aria-current")).toBe("page");
});

it("keeps Home children mounted while category workspaces are visited", () => {
  const mounted = vi.fn();
  function PersistentHome() {
    useState(() => { mounted(); return true; });
    return <p>지속 Home</p>;
  }
  function PersistentHarness() {
    const [activeCategory, setActiveCategory] = useState<WorkspaceCategoryId>("home");
    return <AppShell activeCategory={activeCategory} onCategoryChange={setActiveCategory} onOpenModule={() => undefined}><PersistentHome /></AppShell>;
  }
  render(<PersistentHarness />);
  fireEvent.click(screen.getByRole("button", { name: "일정·업무" }));
  fireEvent.click(screen.getByRole("button", { name: "홈" }));
  expect(mounted).toHaveBeenCalledOnce();
});

it("does not present unconnected external actions as executable School tools", () => {
  render(<AppShell activeCategory="school" onCategoryChange={() => undefined} onOpenModule={() => undefined} canOpenModule={(id) => id === "work-portal"}><p>합성 Home</p></AppShell>);
  expect(screen.getByRole("button", { name: /업무포털/ }).hasAttribute("disabled")).toBe(false);
  expect(screen.getByRole("button", { name: /온라인 보건실/ }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: /AED 점검/ }).textContent).toContain("현재 Electron에서 미지원");
});
