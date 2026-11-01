import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyPurchaseItem, withPurchaseIssues } from "./purchaseDomain";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

import { purchaseRepository } from "./purchaseRepository";

describe("purchaseRepository Edufine export", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    mocks.invoke.mockResolvedValue(true);
  });
  it("does not send invalid persisted mappings to either analyzer", async () => {
    const invalid = [{ id: "old", name: "old", headerSignature: ["품명", "수량"], mapping: { name: 0, quantity: -1 } }];
    await purchaseRepository.pickAndAnalyze(invalid);
    await purchaseRepository.analyzePaths(["synthetic.csv"], invalid);
    expect(mocks.invoke).toHaveBeenCalledWith("pick_and_analyze_purchase_files", { templates: [] });
    expect(mocks.invoke).toHaveBeenCalledWith("analyze_purchase_paths", { paths: ["synthetic.csv"], templates: [] });
    expect(invalid[0]?.mapping.quantity).toBe(-1);
  });
  it("retains conflicting same-signature templates for backend conflict checks", async () => {
    const templates = [
      { id: "first", name: "first", headerSignature: ["품명", "수량"], mapping: { name: 0, quantity: 1 } },
      { id: "second", name: "second", headerSignature: ["품명", "수량"], mapping: { name: 1, quantity: 0 } },
    ];
    await purchaseRepository.analyzePaths(["synthetic.csv"], templates);
    expect(mocks.invoke).toHaveBeenCalledWith("analyze_purchase_paths", { paths: ["synthetic.csv"], templates });
  });

  it("keeps the existing general XLSX export contract", async () => {
    const first = withPurchaseIssues({ ...createEmptyPurchaseItem("first"), name: "합성 품목 A", quantity: 2, unitPrice: 1_000 });
    const skipped = withPurchaseIssues({ ...createEmptyPurchaseItem("skipped"), selected: false, name: "합성 제외 품목", quantity: 1, unitPrice: 500 });

    await purchaseRepository.export("xlsx", [first, skipped], ["name", "quantity", "unitPrice"]);

    expect(mocks.invoke).toHaveBeenCalledWith("save_purchase_export", {
      format: "xlsx",
      items: [first],
      columns: ["name", "quantity", "unitPrice"],
    });
  });

  it("sends only selected items in their current UI order", async () => {
    const first = withPurchaseIssues({ ...createEmptyPurchaseItem("first"), name: "합성 품목 A", quantity: 2, unitPrice: 1_000 });
    const skipped = withPurchaseIssues({ ...createEmptyPurchaseItem("skipped"), selected: false, name: "합성 제외 품목", quantity: 1, unitPrice: 500 });
    const second = withPurchaseIssues({ ...createEmptyPurchaseItem("second"), name: "합성 품목 B", quantity: 3, unitPrice: 2_000 });

    await purchaseRepository.exportEdufine([first, skipped, second]);

    expect(mocks.invoke).toHaveBeenCalledWith("save_purchase_edufine_export", { items: [first, second] });
  });
});
