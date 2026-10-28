// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarSurfaceWidget } from "./CalendarSurfaceWidget";
import { TaskSurfaceWidget } from "./TaskSurfaceWidget";
import { syntheticSurfaceProjection } from "../projection";

afterEach(cleanup);

describe("Surface interaction widgets", () => {
  it("reveals a full calendar event title without opening Main in preview", () => {
    const onSyntheticAction = vi.fn();
    render(<CalendarSurfaceWidget events={syntheticSurfaceProjection.calendarEvents}
      now={new Date(syntheticSurfaceProjection.generatedAt)} onSyntheticAction={onSyntheticAction} />);

    fireEvent.click(screen.getByRole("button", { name: "합성 교육 일정 일정 선택" }));

    expect(screen.getByRole("status").textContent).toContain("합성 교육 일정");
    expect(screen.getByText("Main 연결 시 해당 일정으로 이동합니다.")).toBeTruthy();
    expect(onSyntheticAction).toHaveBeenCalledWith("합성 일정 선택 · 합성 교육 일정");
  });

  it("selects a task and shows details without changing completion", () => {
    const task = syntheticSurfaceProjection.tasks[0];
    if (task === undefined) throw new Error("Synthetic task fixture is required");
    const { container } = render(<TaskSurfaceWidget tasks={syntheticSurfaceProjection.tasks} />);

    fireEvent.click(screen.getByRole("button", { name: `${task.label} 상세 보기` }));

    expect(screen.getByRole("status").textContent).toContain(task.label);
    expect(screen.getByRole("status").textContent).toContain("미완료");
    expect(screen.getByRole("button", { name: `${task.label} 상세 보기` }).getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelectorAll(".surface-task-list li.is-complete")).toHaveLength(1);
  });
});
