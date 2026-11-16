// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StudentArtLibrary } from "./StudentArtLibrary";
import { createNewsletterDesignState } from "./designSchema";
import { upgradeNewsletterDesignStateV2 } from "./designState";
afterEach(cleanup);
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); }; });
const now = "2026-11-13T00:00:00.000Z";
const fixture = () => upgradeNewsletterDesignStateV2(createNewsletterDesignState({ projectId: "library-ui", canonicalProjectRevision: 1, now }), now);
describe("review-only library confirmation", () => {
    it("filters and cancels without mutating a document or calling onChange", () => {
        const design = fixture(), before = JSON.stringify(design), onChange = vi.fn();
        render(<StudentArtLibrary design={design} mode="cards" index={1} topic="손 씻기" onChange={onChange}/>);
        fireEvent.click(screen.getByRole("button", {name:"학생 삽화 선택",exact:true}));
        fireEvent.click(screen.getByRole("button", { name: "남학생" }));
        fireEvent.click(screen.getByText("취소 · 현재 문서 유지"));
        expect(onChange).not.toHaveBeenCalled();
        expect(JSON.stringify(design)).toBe(before);
    });
    it("requires explicit review acknowledgment and commits one revision only", () => {
        const design = fixture(), onChange = vi.fn();
        render(<StudentArtLibrary design={design} mode="cards" index={1} topic="손 씻기" onChange={onChange}/>);
        fireEvent.click(screen.getByRole("button", {name:"학생 삽화 선택",exact:true}));
        fireEvent.click(screen.getByAltText("손 씻기 A · 원본 장면"));
        const apply = screen.getByText("비교한 슬롯에 적용 · 새 revision");
        expect(apply).toHaveProperty("disabled", true);
        fireEvent.click(screen.getByLabelText("승인 대기 그림을 검수용 편집본에서만 확인합니다."));
        fireEvent.click(apply);
        fireEvent.click(apply);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.calls[0]?.[0].designRevision).toBe(design.designRevision + 1);
    });
    it("rejects a stale comparison rather than replacing newer edits", () => {
        const design = fixture(), onChange = vi.fn();
        const view = render(<StudentArtLibrary design={design} mode="cards" index={1} topic="" onChange={onChange}/>);
        fireEvent.click(screen.getByRole("button", {name:"학생 삽화 선택",exact:true}));
        fireEvent.click(screen.getByText("학생 없음 · 해당 슬롯의 그림 미사용"));
        view.rerender(<StudentArtLibrary design={{ ...design, designRevision: design.designRevision + 1 }} mode="cards" index={1} topic="" onChange={onChange}/>);
        fireEvent.click(screen.getByText("비교한 슬롯에 적용 · 새 revision"));
        expect(screen.getByRole("alert").textContent).toContain("편집본이 변경");
        expect(onChange).not.toHaveBeenCalled();
    });
});
