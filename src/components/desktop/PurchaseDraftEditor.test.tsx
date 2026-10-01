import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createPurchaseDraft } from "../../purchase/purchaseDraft";
import { createEmptyPurchaseItem, withPurchaseIssues } from "../../purchase/purchaseDomain";
import { defaultPurchaseOutputColumns } from "../../purchase/types";
import { PurchaseDraftEditor } from "./PurchaseDraftEditor";

describe("PurchaseDraftEditor", () => {
  it("renders editable fields, deterministic preview, and both copy actions", () => {
    const item = withPurchaseIssues({ ...createEmptyPurchaseItem("item-1"), name: "장갑", quantity: 2, unitPrice: 12_000, vendor: "○○업체", budgetItem: "운영비" });
    const markup = renderToStaticMarkup(<PurchaseDraftEditor
      columns={defaultPurchaseOutputColumns}
      draft={createPurchaseDraft([item])}
      items={[item]}
      templates={[]}
      onChange={() => undefined}
      onNotice={() => undefined}
      onTemplatesChange={() => undefined}
    />);
    expect(markup).toContain("품의 제목");
    expect(markup).toContain("금24,000원");
    expect(markup).toContain("○○업체");
    expect(markup).toContain("붙임  품목내역 1부.  끝.");
    expect(markup).toContain("품의문 복사");
    expect(markup).toContain("품의문 + 품목표 복사");
  });

  it("renders only reusable template metadata controls", () => {
    const draft = createPurchaseDraft([]);
    const markup = renderToStaticMarkup(<PurchaseDraftEditor
      columns={defaultPurchaseOutputColumns}
      draft={{ ...draft, templateId: "draft-1" }}
      items={[]}
      templates={[{ id: "draft-1", name: "행정실 양식", titlePattern: "{{title}}", introPattern: "{{purpose}}", detailFieldOrder: ["summary", "amount", "vendor", "budgetItem"], attachmentPhrase: "붙임  품목내역 1부.  끝.", includeAttachment: true }]}
      onChange={() => undefined}
      onNotice={() => undefined}
      onTemplatesChange={() => undefined}
    />);
    expect(markup).toContain("행정실 양식");
    expect(markup).toContain("행정실 양식 템플릿 삭제");
    expect(markup).not.toContain("실제 구매 데이터");
  });
});
