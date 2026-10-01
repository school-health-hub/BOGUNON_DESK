import { describe, expect, it } from "vitest";
import { createEmptyPurchaseItem, withPurchaseIssues } from "./purchaseDomain";
import { createPurchaseClipboard } from "./purchaseClipboard";

describe("purchase clipboard", () => {
  it("creates safe HTML and tab/newline-safe TSV", () => {
    const item = withPurchaseIssues({ ...createEmptyPurchaseItem("1"), name: "<마스크>&", note: "한\t줄\n메모", quantity: 2, unitPrice: 10 });
    const output = createPurchaseClipboard([item], ["name", "amount", "note"]);
    expect(output.text).toContain("<마스크>&\t20\t한 줄 메모");
    expect(output.html).toContain("&lt;마스크&gt;&amp;");
  });
});
