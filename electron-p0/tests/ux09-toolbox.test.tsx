// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolboxMenu } from "../renderer/toolbox/ToolboxMenu";
import { matchesToolSearch, toolDefinitions, toolGroups, toolIds } from "../renderer/toolbox/toolDefinitions";

afterEach(cleanup);

describe("UX-09 toolbox registry", () => {
  it("keeps every declared route unique and assigned to a known group", () => {
    expect(new Set(toolIds).size).toBe(toolIds.length);
    expect(toolDefinitions.map((tool) => tool.id)).toEqual(toolIds);
    expect(toolDefinitions.every((tool) => toolGroups.some((group) => group.id === tool.group))).toBe(true);
  });

  it("finds a tool by teacher-facing title, description, or keyword", () => {
    const newsletter = toolDefinitions.find((tool) => tool.id === "newsletter");
    expect(newsletter).toBeDefined();
    if (newsletter === undefined) return;
    expect(matchesToolSearch(newsletter, "가정통신문")).toBe(true);
    expect(matchesToolSearch(newsletter, "원고")).toBe(true);
    expect(matchesToolSearch(newsletter, "품의")).toBe(false);
  });
});

describe("UX-09 toolbox menu", () => {
  it("filters grouped tools while keeping customization actions available", () => {
    const onRun = vi.fn();
    const onOpenWorkspaceEditor = vi.fn();
    render(<ToolboxMenu onRun={onRun} onOpenWorkspaceEditor={onOpenWorkspaceEditor} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "업무 도구 검색" }), { target: { value: "공문" } });
    expect(screen.getByRole("button", { name: "공문작업실" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "업무 계산기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "공문작업실" }));
    expect(onRun).toHaveBeenCalledWith("official-document");

    fireEvent.click(screen.getByRole("button", { name: "위젯 표시 설정" }));
    expect(onOpenWorkspaceEditor).toHaveBeenCalledWith("library");
  });

  it("shows a calm empty state and keeps storage guidance discoverable", () => {
    render(<ToolboxMenu onRun={vi.fn()} onOpenWorkspaceEditor={vi.fn()} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "업무 도구 검색" }), { target: { value: "존재하지 않는 업무" } });
    expect(screen.getByRole("status").textContent).toContain("검색 결과가 없습니다.");
    expect(screen.getByText("저장·보안 안내")).toBeTruthy();
  });
});
