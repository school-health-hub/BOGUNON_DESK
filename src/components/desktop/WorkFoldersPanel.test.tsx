import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WorkFoldersPanel } from "./WorkFoldersPanel";

describe("WorkFoldersPanel", () => {
  it("renders an add action for an empty device-only list", () => {
    const markup = renderToStaticMarkup(<WorkFoldersPanel favorites={[]} isLoading={false} onAdd={() => undefined} onClose={() => undefined} onOpen={() => undefined} />);
    expect(markup).toContain("등록된 업무 폴더가 없습니다.");
    expect(markup).toContain("폴더 추가");
  });

  it("keeps missing folders visible and disables opening them", () => {
    const markup = renderToStaticMarkup(<WorkFoldersPanel favorites={[{ id: "folder-1", name: "검진", path: "C:\\missing", displayPath: "C:\\missing", available: false }]} isLoading={false} onAdd={() => undefined} onClose={() => undefined} onOpen={() => undefined} />);
    expect(markup).toContain("폴더를 찾을 수 없음");
    expect(markup).toContain("disabled");
  });
});
