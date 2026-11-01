// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PurchaseOutputPreviewSnapshot } from "../../purchase/purchaseOutputPreview";
import { PurchaseOutputPreviewDialog } from "./PurchaseOutputPreviewDialog";

const snapshot: PurchaseOutputPreviewSnapshot = {
  kind: "csv", table: { headers: ["품명", "금액"], rows: [["합성 품목", 200], ["전체 이름\n두 번째 줄", null]] },
  key: "initial", selectedCount: 2, hiddenCount: 1, plannedTotal: 200, guidance: [{ name: "출력 안내", value: "기존 출력 금액" }], blocked: [],
};
afterEach(cleanup);
describe("PurchaseOutputPreviewDialog", () => {
  it("shows the exact supplied table, selected counts and summary", () => {
    render(<PurchaseOutputPreviewDialog snapshot={snapshot} currentKey="initial" onClose={vi.fn()} onOutput={vi.fn()} />);
    expect(screen.getByRole("dialog").textContent).toContain("선택 2건 · 현재 필터에서 숨겨진 선택 1건 · 실제 출력 2행");
    expect(screen.getByRole("table").textContent).toContain("전체 이름\n두 번째 줄");
    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(2);
    expect(screen.getByRole("dialog").textContent).toContain("200원");
  });
  it("blocks stale confirmation even when clicked", () => {
    const output = vi.fn();
    render(<PurchaseOutputPreviewDialog snapshot={snapshot} currentKey="changed" onClose={vi.fn()} onOutput={output} />);
    fireEvent.click(screen.getByRole("button", { name: "확인한 내용으로 출력" }));
    expect(screen.getByRole("alert").textContent).toContain("다시 열어");
    expect(output).not.toHaveBeenCalled();
  });
  it("blocks output for readiness reasons", () => {
    const output = vi.fn();
    render(<PurchaseOutputPreviewDialog snapshot={{ ...snapshot, blocked: ["입력 오류"] }} currentKey="initial" onClose={vi.fn()} onOutput={output} />);
    fireEvent.click(screen.getByRole("button", { name: "확인한 내용으로 출력" }));
    expect(output).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("입력 오류");
  });
  it("confirms the supplied snapshot when unchanged", () => {
    const output = vi.fn();
    render(<PurchaseOutputPreviewDialog snapshot={snapshot} currentKey="initial" onClose={vi.fn()} onOutput={output} />);
    fireEvent.click(screen.getByRole("button", { name: "확인한 내용으로 출력" }));
    expect(output).toHaveBeenCalledOnce();
  });
  it("traps focus, closes with Escape and restores the opener", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const close = vi.fn();
    const view = render(<PurchaseOutputPreviewDialog snapshot={snapshot} currentKey="initial" onClose={close} onOutput={vi.fn()} />);
    const first = screen.getByRole("button", { name: "미리보기 닫기" });
    const last = screen.getByRole("button", { name: "확인한 내용으로 출력" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
    view.unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
