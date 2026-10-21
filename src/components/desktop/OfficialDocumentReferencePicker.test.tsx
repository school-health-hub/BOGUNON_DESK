// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSyntheticOfficialDocumentReferenceRepository } from "../../official-document/referenceRepository";
import { OfficialDocumentReferencePicker } from "./OfficialDocumentReferencePicker";

describe("OfficialDocumentReferencePicker", () => {
  afterEach(cleanup);

  it("searches, selects, previews, and applies only after an explicit action", async () => {
    const onSelect = vi.fn();
    const onApply = vi.fn();
    const repository = createSyntheticOfficialDocumentReferenceRepository();
    const { rerender } = render(
      <OfficialDocumentReferencePicker repository={repository} selected={null} onSelect={onSelect} onApply={onApply} />,
    );
    await screen.findByText("학교보건 계획 기안 예시");
    fireEvent.change(screen.getByLabelText("문서 목적"), { target: { value: "안내문 발송" } });
    expect(screen.getByText("예방 수칙 안내 예시")).toBeTruthy();
    expect(screen.queryByText("학교보건 계획 기안 예시")).toBeNull();
    fireEvent.change(screen.getByLabelText("문서 목적"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("업무 분야"), { target: { value: "건강검진 결과보고" } });
    expect(screen.getByText("건강검진 결과 보고 예시")).toBeTruthy();
    expect(screen.queryByText("예방 수칙 안내 예시")).toBeNull();
    fireEvent.change(screen.getByLabelText("업무 분야"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("참고자료 검색"), { target: { value: "표 포함" } });
    fireEvent.click(screen.getByRole("button", { name: /표 포함 결과 예시/ }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onApply).not.toHaveBeenCalled();
    const selected = onSelect.mock.calls[0]?.[0];
    rerender(<OfficialDocumentReferencePicker repository={repository} selected={selected} onSelect={onSelect} onApply={onApply} />);
    expect(await screen.findByText("표 복사용 본문")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "초안에 적용" }));
    expect(onApply).toHaveBeenCalledWith(selected);
  });

  it("distinguishes not-connected, empty, and failed repository states", async () => {
    render(
      <OfficialDocumentReferencePicker
        repository={createSyntheticOfficialDocumentReferenceRepository({ connected: false })}
        selected={null}
        onSelect={vi.fn()}
        onApply={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText("참고자료 연결 전")).toBeTruthy());
    expect(screen.getByText(/Phase 1B 연결 전까지/)).toBeTruthy();
    cleanup();
    render(<OfficialDocumentReferencePicker repository={{ list: async () => ({ status: "empty" }) }} selected={null} onSelect={vi.fn()} onApply={vi.fn()} />);
    expect(await screen.findByText("사용 가능한 참고자료가 없습니다.")).toBeTruthy();
    cleanup();
    render(<OfficialDocumentReferencePicker repository={{ list: async () => { throw new Error("synthetic failure"); } }} selected={null} onSelect={vi.fn()} onApply={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "참고자료를 불러오지 못했습니다.");
  });
});
