import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RecordHelperPanel } from "./RecordHelperPanel";

describe("RecordHelperPanel", () => {
  it("renders the local workspace and privacy guidance", () => {
    const markup = renderToStaticMarkup(<RecordHelperPanel onClose={vi.fn()} />);

    expect(markup).toContain("생기부 도우미");
    expect(markup).toContain("비식별 활동·관찰 메모를 정리해 기록 문구를 준비합니다.");
    expect(markup).toContain("비식별 활동·관찰 메모");
    expect(markup).toContain("작성 요청 / 강조할 점");
    expect(markup).toContain("학생 이름·학번·연락처·건강정보 등 개인을 식별할 수 있는 정보는 입력하지 마세요.");
    expect(markup).toContain("자동 개인정보 검사는 보조 기능이며 모든 정보를 탐지하지 못할 수 있습니다.");
    expect(markup).toContain("입력 내용 점검");
  });

  it("does not present an enabled AI or transmission action", () => {
    const markup = renderToStaticMarkup(<RecordHelperPanel onClose={vi.fn()} />);

    expect(markup).not.toContain("AI 작성</button>");
    expect(markup).not.toContain("전송 준비</button>");
    expect(markup).not.toContain("ChatGPT");
  });
});
