import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createEmptyPurchaseItem, withPurchaseIssues } from "../../purchase/purchaseDomain";
import { createPurchaseSettlement } from "../../purchase/purchaseSettlement";
import { PurchaseSettlementEditor } from "./PurchaseSettlementEditor";

describe("PurchaseSettlementEditor", () => {
  it("renders editable settlement controls and compact summaries", () => {
    const items = [withPurchaseIssues({
      ...createEmptyPurchaseItem("item-1"),
      name: "일회용 장갑",
      quantity: 2,
      unitPrice: 12_000,
    })];
    const markup = renderToStaticMarkup(<PurchaseSettlementEditor
      items={items}
      outputReady
      settlement={createPurchaseSettlement(items)}
      onChange={() => undefined}
      onNotice={() => undefined}
    />);

    expect(markup).toContain("구매 정산 요약");
    expect(markup).toContain("품의금액");
    expect(markup).toContain("상품 실제금액");
    expect(markup).toContain("1행 구매 상태");
    expect(markup).toContain("1행 실제 수량");
    expect(markup).toContain("구매결과 표 복사");
    expect(markup).toContain("구매결과 XLSX");
  });

  it("disables settlement copy and export actions when output is not ready", () => {
    const items = [withPurchaseIssues({
      ...createEmptyPurchaseItem("item-1"),
      name: "합성 품목",
      quantity: 1,
      unitPrice: 1_000,
    })];
    const markup = renderToStaticMarkup(<PurchaseSettlementEditor
      items={items}
      outputReady={false}
      settlement={createPurchaseSettlement(items)}
      onChange={() => undefined}
      onNotice={() => undefined}
    />);

    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>.*?구매결과 표 복사<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>.*?정산 요약 복사<\/button>/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>.*?구매결과 XLSX<\/button>/);
  });
});
