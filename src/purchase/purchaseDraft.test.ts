import { describe, expect, it } from "vitest";
import { createEmptyPurchaseItem, withPurchaseIssues } from "./purchaseDomain";
import { createPurchaseDraft, createPurchaseDraftClipboard, createPurchaseDraftText, defaultPurchaseDraftTemplate, suggestPurchaseDraftValue } from "./purchaseDraft";

const item = (id: string, patch: Partial<ReturnType<typeof createEmptyPurchaseItem>>) => withPurchaseIssues({ ...createEmptyPurchaseItem(id), name: id, ...patch });

describe("purchase draft", () => {
  it("uses selected totals and shared vendor and budget suggestions", () => {
    const items = [
      item("장갑", { quantity: 2, unitPrice: 12_000, vendor: "○○업체", budgetItem: "보건실 운영비" }),
      item("알코올솜", { quantity: 3, unitPrice: 3_500, vendor: "○○업체", budgetItem: "보건실 운영비" }),
    ];
    const draft = createPurchaseDraft(items);
    expect(draft.vendor).toBe("○○업체");
    expect(draft.budgetItem).toBe("보건실 운영비");
    expect(createPurchaseDraftText(draft, items)).toContain("금34,500원");
  });

  it("applies reusable title and introduction patterns", () => {
    const items = [item("1", { quantity: 1, unitPrice: 1_000 })];
    const draft = { ...createPurchaseDraft(items), title: "소모품 구매", purpose: "보건실 운영 물품을 구매합니다", titlePattern: "[품의] {{title}}", introPattern: "{{purpose}}. 아래와 같이 추진합니다." };
    const template = { ...defaultPurchaseDraftTemplate, titlePattern: draft.titlePattern, introPattern: draft.introPattern };
    expect(createPurchaseDraftText(draft, items, template)).toContain("[품의] 소모품 구매\n\n보건실 운영 물품을 구매합니다. 아래와 같이 추진합니다.");
  });

  it("marks mixed suggestions without choosing an arbitrary value", () => {
    const items = [item("1", { vendor: "A", budgetItem: "항목 A" }), item("2", { vendor: "B", budgetItem: "항목 B" })];
    expect(suggestPurchaseDraftValue(items, "vendor")).toBe("여러 구매처");
    expect(suggestPurchaseDraftValue(items, "budgetItem")).toBe("여러 예산항목");
    expect(suggestPurchaseDraftValue([item("3", { vendor: "A" }), item("4", { vendor: "" })], "vendor")).toBe("여러 구매처");
  });

  it("omits blank optional details and renumbers remaining rows", () => {
    const items = [item("1", { quantity: 1, unitPrice: 1_000 })];
    const draft = { ...createPurchaseDraft(items), purchaseSummary: "소모품", vendor: "", budgetItem: "예산", includeAttachment: false };
    expect(createPurchaseDraftText(draft, items)).toContain("가. 구매내용: 소모품\n나. 구매금액: 금1,000원\n다. 예산항목: 예산");
    expect(createPurchaseDraftText(draft, items)).not.toContain("붙임");
  });

  it("creates escaped HTML and combines plain draft with the TSV table", () => {
    const items = [item("1", { name: "<장갑>", quantity: 1, unitPrice: 2_000 })];
    const draft = { ...createPurchaseDraft(items), title: "<물품> 구매" };
    const clipboard = createPurchaseDraftClipboard(draft, items, ["name", "amount"], defaultPurchaseDraftTemplate, true);
    expect(clipboard.text).toContain("<물품> 구매\n\n");
    expect(clipboard.text).toContain("품명\t금액\n<장갑>\t2000");
    expect(clipboard.html).toContain("&lt;물품&gt; 구매");
    expect(clipboard.html).toContain("&lt;장갑&gt;");
  });
});
