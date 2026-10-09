import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultPurchaseOutputColumns } from "../../purchase/types";
import { PurchaseHelperPanel } from "./PurchaseHelperPanel";

describe("PurchaseHelperPanel import mapping", () => {
  it("describes text PDF support without promising scanned-document OCR", () => {
    const markup = renderToStaticMarkup(<PurchaseHelperPanel
      items={[]}
      sources={[{ sourceName: "스캔견적.pdf", status: "unsupported", rowCount: 0, message: "텍스트를 읽을 수 없는 PDF입니다. 스캔 문서 OCR은 현재 지원하지 않습니다." }]}
      candidates={[]}
      columns={defaultPurchaseOutputColumns}
      templates={[]}
      draft={null}
      draftTemplates={[]}
      settlement={null}
      onAnalysis={() => undefined}
      onAddItem={() => undefined}
      onCandidatesChange={() => undefined}
      onChange={() => undefined}
      onClose={() => undefined}
      onColumnsChange={() => undefined}
      onNotice={() => undefined}
      onSourcesChange={() => undefined}
      onTemplatesChange={() => undefined}
      onDraftChange={() => undefined}
      onDraftTemplatesChange={() => undefined}
      onSettlementChange={() => undefined}
    />);
    expect(markup).toContain("XLSX · XLS · CSV · 텍스트형 PDF 자동 분석");
    expect(markup).toContain("스캔 PDF · PNG · JPG OCR은 아직 지원하지 않습니다.");
    expect(markup).toContain("스캔 문서 OCR은 현재 지원하지 않습니다.");
  });

  it("shows a mapping action for an unresolved source and saved template metadata", () => {
    const markup = renderToStaticMarkup(<PurchaseHelperPanel
      items={[]}
      sources={[{ sourceName: "견적서.xlsx", status: "needsMapping", rowCount: 0, message: "열 구성을 확인해 주세요.", candidateId: "candidate-1" }]}
      candidates={[{ id: "candidate-1", sourceName: "견적서.xlsx", sheetName: "Sheet1", rows: [["상품", "주문개수"]], headerOptions: [{ rowIndex: 0, headers: ["상품", "주문개수"], signature: ["상품", "주문개수"], recommended: true }] }]}
      columns={defaultPurchaseOutputColumns}
      templates={[{ id: "template-1", name: "학교장터", headerSignature: ["상품", "주문개수"], mapping: { name: 0, quantity: 1 } }]}
      draft={null}
      draftTemplates={[]}
      settlement={null}
      onAnalysis={() => undefined}
      onAddItem={() => undefined}
      onCandidatesChange={() => undefined}
      onChange={() => undefined}
      onClose={() => undefined}
      onColumnsChange={() => undefined}
      onNotice={() => undefined}
      onSourcesChange={() => undefined}
      onTemplatesChange={() => undefined}
      onDraftChange={() => undefined}
      onDraftTemplatesChange={() => undefined}
      onSettlementChange={() => undefined}
    />);
    expect(markup).toContain("열 지정");
    expect(markup).toContain("열 구성을 확인해 주세요.");
    expect(markup).toContain("가져오기 설정");
    expect(markup).toContain("품의문 작성");
  });
});
