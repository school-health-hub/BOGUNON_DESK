// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarWidget } from "./CalendarWidget";
const hooks = vi.hoisted(() => ({ addDate: vi.fn() }));
vi.mock("../components/desktop/DesktopPanelContext", () => ({ useDesktopPanels: () => ({ openQuickAddEventForDate: hooks.addDate }) }));
vi.mock("../dashboard/WidgetSessionContext", () => ({ useWidgetSession: () => ({ now: new Date(2026, 9, 21) }) }));
vi.mock("../workspace-data/WorkspaceDataContext", () => ({ useWorkspaceData: () => ({ state: { status: "ready", data: {
  calendarEvents: [1, 2, 3].map(id => ({ id: `synthetic-${id}`, title: `합성 일정 ${id}`, targetDate: "2026-10-21", category: "교육" })),
} } }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("calendar accessible overflow", () => {
  it("opens every title without saving and restores focus after Escape", () => {
    render(<CalendarWidget />);
    const trigger = screen.getByRole("button", { name: "2개 일정 더 있음" });
    fireEvent.click(trigger);
    const detail = screen.getByRole("region", { name: "2026-10-21 전체 일정" });
    expect(document.querySelector(".calendar-grid")?.hasAttribute("inert")).toBe(true);
    expect(detail.querySelectorAll("li")).toHaveLength(3);
    expect(detail.textContent).toContain("합성 일정 3");
    expect(hooks.addDate).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("button", { name: "닫기" }), { key: "Escape" });
    expect(screen.queryByRole("region")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector(".calendar-grid")?.hasAttribute("inert")).toBe(false);
  });
  it("keeps the existing date Quick Add action and close button", () => {
    render(<CalendarWidget />);
    fireEvent.click(screen.getByRole("button", { name: "2026년 10월 22일 일정 추가" }));
    expect(hooks.addDate).toHaveBeenCalledExactlyOnceWith("2026-10-22");
    fireEvent.click(screen.getByRole("button", { name: "2개 일정 더 있음" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("region")).toBeNull();
  });
});
