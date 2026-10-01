import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OfficialDocumentSourceField } from "./OfficialDocumentSourceField";

const renderField = (sourceName: string | null, isImporting = false): string => renderToStaticMarkup(
  <OfficialDocumentSourceField
    id="revision-original"
    isImporting={isImporting}
    onChange={vi.fn()}
    onImport={vi.fn()}
    placeholder="원문"
    rows={12}
    sourceName={sourceName}
    value=""
  />,
);

describe("OfficialDocumentSourceField", () => {
  it("renders a compact PDF/HWPX import control and basename metadata", () => {
    const markup = renderField("교육청 안내.hwpx");
    expect(markup).toContain("PDF/HWPX 가져오기");
    expect(markup).toContain("HWPX");
    expect(markup).toContain("교육청 안내.hwpx");
    expect(markup).not.toContain("C:\\");
  });

  it("locks the import control while processing", () => {
    const markup = renderField(null, true);
    expect(markup).toContain("가져오는 중…");
    expect(markup).toContain("disabled");
  });
});
