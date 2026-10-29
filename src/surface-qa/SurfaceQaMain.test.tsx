import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SurfaceQaMain } from "./SurfaceQaMain";

const commands = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("./editCommands", () => ({ sendQaEditCommand: commands.send }));

describe("SurfaceQaMain", () => {
  beforeEach(() => commands.send.mockReset().mockResolvedValue(undefined));

  it.each([
    ["Command begin_desktop_surface_edit not allowed by ACL", "acl_denied"],
    ["caller_denied", "caller_denied"],
    ["runtime_inactive", "runtime_inactive"],
    ["frame_write_failed", "frame_write_failed"],
    ["private-path-and-credential", "unknown"],
  ])("shows only a safe classification for rejected edit requests", async (error, code) => {
    commands.send.mockRejectedValueOnce(error);
    render(<SurfaceQaMain sourceSha="NOT_BUILT" />);
    fireEvent.click(screen.getByRole("button", { name: "편집 시작" }));
    expect(await screen.findByText(`편집 명령 실패: ${code}`)).toBeTruthy();
    expect(screen.queryByText("private-path-and-credential")).toBeNull();
    expect(screen.getByRole("button", { name: "편집 시작" })).toBeTruthy();
  });

  it("labels the shell as synthetic-only and exposes source provenance", () => {
    render(<SurfaceQaMain sourceSha="9941e91076e1d6ef352c001cca233de0b60b9b21" />);

    expect(screen.getByText("SYNTHETIC ONLY")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Desktop Surface QA" })).toBeTruthy();
    expect(screen.getByText("9941e91076e1")).toBeTruthy();
  });

  it("presents only the three isolated QA readiness statements", () => {
    render(<SurfaceQaMain sourceSha="NOT_BUILT" />);

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("합성 projection")).toBeTruthy();
    expect(screen.getByText("운영 저장소 분리")).toBeTruthy();
    expect(screen.getByText("Surface 연결 대기")).toBeTruthy();
  });

  it("sends only the fixed edit lifecycle commands and reports the result", async () => {
    render(<SurfaceQaMain sourceSha="NOT_BUILT" />);

    fireEvent.click(screen.getByRole("button", { name: "편집 시작" }));
    await waitFor(() => expect(commands.send).toHaveBeenLastCalledWith("begin"));
    expect(screen.getByText("편집 모드 시작됨")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "편집 완료" }));
    await waitFor(() => expect(commands.send).toHaveBeenLastCalledWith("complete"));
    expect(screen.getByText("편집 완료됨")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "편집 시작" }));
    await waitFor(() => expect(commands.send).toHaveBeenLastCalledWith("begin"));
    fireEvent.click(screen.getByRole("button", { name: "편집 취소" }));
    await waitFor(() => expect(commands.send).toHaveBeenLastCalledWith("cancel"));
    expect(screen.getByText("편집 취소됨")).toBeTruthy();
  });
});
