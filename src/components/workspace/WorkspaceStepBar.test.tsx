// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceStepBar, type WorkspaceStep } from "./WorkspaceStepBar";

const newsletterReviewSteps = [
  { id: "month", label: "월 선택", state: "completed" },
  { id: "ai", label: "AI 제작", state: "completed" },
  { id: "review", label: "원고 검토", state: "available" },
  { id: "design", label: "디자인 편집", state: "available" },
  { id: "output", label: "출력", state: "disabled" },
] as const satisfies readonly WorkspaceStep[];

afterEach(cleanup);

describe("WorkspaceStepBar", () => {
  it("announces one current step and keeps the approved order visible", () => {
    render(
      <WorkspaceStepBar
        activeStepId="review"
        ariaLabel="보건소식지 제작 단계"
        steps={newsletterReviewSteps}
      />,
    );

    const navigation = screen.getByRole("navigation", { name: "보건소식지 제작 단계" });
    const items = navigation.querySelectorAll("li");
    expect(items).toHaveLength(5);
    expect([...items].map((item) => item.textContent)).toEqual([
      expect.stringContaining("월 선택"),
      expect.stringContaining("AI 제작"),
      expect.stringContaining("원고 검토"),
      expect.stringContaining("디자인 편집"),
      expect.stringContaining("출력"),
    ]);
    expect(screen.getAllByRole("button").filter((button) => button.getAttribute("aria-current") === "step")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /원고 검토/ }).getAttribute("aria-current")).toBe("step");
    expect(screen.getByText("현재 단계 3/5 · 원고 검토")).toBeTruthy();
  });

  it("invokes only enabled steps and exposes completed and disabled states", () => {
    const onStepSelect = vi.fn();
    render(
      <WorkspaceStepBar
        activeStepId="review"
        ariaLabel="보건소식지 제작 단계"
        onStepSelect={onStepSelect}
        steps={newsletterReviewSteps}
      />,
    );

    const completed = screen.getByRole("button", { name: /월 선택/ });
    const available = screen.getByRole("button", { name: /디자인 편집/ });
    const disabled = screen.getByRole("button", { name: /출력/ });
    expect(completed.closest("li")?.dataset.state).toBe("completed");
    expect((disabled as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(completed);
    fireEvent.click(available);
    fireEvent.click(disabled);
    expect(onStepSelect).toHaveBeenNthCalledWith(1, "month");
    expect(onStepSelect).toHaveBeenNthCalledWith(2, "design");
    expect(onStepSelect).toHaveBeenCalledTimes(2);
  });

  it("falls back to the first enabled step when the active id is stale", () => {
    render(
      <WorkspaceStepBar
        activeStepId="removed-step"
        ariaLabel="보건소식지 제작 단계"
        steps={newsletterReviewSteps}
      />,
    );

    expect(screen.getByRole("button", { name: /월 선택/ }).getAttribute("aria-current")).toBe("step");
    expect(screen.getByText("현재 단계 1/5 · 월 선택")).toBeTruthy();
  });
});
