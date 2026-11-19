// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WidgetLayout } from "../../dashboard/types";
import { WidgetSettingsPanel } from "./WidgetSettingsPanel";

const widget: WidgetLayout = {
  id: "widget-quick-memo",
  type: "quick-memo",
  x: 2,
  y: 7,
  w: 4,
  h: 2,
  visible: true,
};

const monitors = [
  { profileKey: "primary", label: "주 모니터", connected: true },
  { profileKey: "secondary", label: "보조 모니터", connected: true },
] as const;

afterEach(cleanup);

describe("WidgetSettingsPanel", () => {
  it.each([
    ["quick-memo", "메모 내용"],
    ["upcoming-schedule", "표시 일정"],
    ["weekly-schedule", "이번 주 범위"],
    ["quick-launcher", "실행 항목"],
    ["dday", "D-Day 기준"],
    ["today-tasks", "오늘의 업무"],
  ] as const)("shows tailored guidance for %s", (type, heading) => {
    render(<WidgetSettingsPanel widget={{ ...widget, id: `widget-${type}`, type }} monitorLabel="주 모니터" monitorOptions={monitors} ownerProfileKey="primary" onCancel={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText(heading)).toBeTruthy();
  });

  it("renders the large card sections with a disabled pristine save action", () => {
    render(<WidgetSettingsPanel widget={widget} monitorLabel="주 모니터" monitorOptions={monitors} ownerProfileKey="primary" onCancel={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "빠른 메모 위젯 설정" })).toBeTruthy();
    expect(screen.getByText("내용 설정")).toBeTruthy();
    expect(screen.getByText("표시 방식")).toBeTruthy();
    expect(screen.getByText("모니터 및 배치")).toBeTruthy();
    expect(screen.getByText("도움말")).toBeTruthy();
    expect((screen.getByRole("button", { name: "저장" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("stages monitor and visibility changes until save", async () => {
    const save = vi.fn(async () => undefined);
    render(<WidgetSettingsPanel widget={widget} monitorLabel="주 모니터" monitorOptions={monitors} ownerProfileKey="primary" onCancel={vi.fn()} onSave={save} />);

    fireEvent.change(screen.getByRole("combobox", { name: "표시 모니터" }), { target: { value: "secondary" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "위젯 표시" }));
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith({ targetProfileKey: "secondary", visible: false }));
  });

  it("protects an unsaved draft on Escape and discards only after confirmation", () => {
    const cancel = vi.fn();
    render(<WidgetSettingsPanel widget={widget} monitorLabel="주 모니터" monitorOptions={monitors} ownerProfileKey="primary" onCancel={cancel} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "위젯 표시" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(cancel).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("저장하지 않은 변경사항");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "계속 편집" }));
    fireEvent.click(screen.getByRole("button", { name: "변경 취소하고 닫기" }));
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("returns focus to the close action when unsaved editing continues", async () => {
    render(<WidgetSettingsPanel widget={widget} monitorLabel="주 모니터" monitorOptions={monitors} ownerProfileKey="primary" onCancel={vi.fn()} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "위젯 표시" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "계속 편집" }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "위젯 설정 닫기" })));
  });

  it("keeps the draft visible and reports a save failure", async () => {
    const save = vi.fn(async () => { throw new Error("합성 저장 실패"); });
    render(<WidgetSettingsPanel widget={widget} monitorLabel="주 모니터" monitorOptions={monitors} ownerProfileKey="primary" onCancel={vi.fn()} onSave={save} />);

    fireEvent.change(screen.getByRole("combobox", { name: "표시 모니터" }), { target: { value: "secondary" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect((await screen.findByRole("alert")).textContent).toContain("합성 저장 실패");
    expect((screen.getByRole("combobox", { name: "표시 모니터" }) as HTMLSelectElement).value).toBe("secondary");
    expect(screen.getByRole("dialog", { name: "빠른 메모 위젯 설정" })).toBeTruthy();
  });
});
