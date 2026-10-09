import { invoke } from "@tauri-apps/api/core";
import type { PurchaseAnalysisRequestResult, PurchaseAnalysisResult, PurchaseColumnMapping, PurchaseImportTemplate, PurchaseItem, PurchaseMappingCandidate, PurchaseOutputColumnId, PurchaseSettlementExportRow, PurchaseSettlementSummary } from "./types";

export const purchaseRepository = {
  pickAndAnalyze: (templates: readonly PurchaseImportTemplate[]): Promise<PurchaseAnalysisRequestResult> => invoke("pick_and_analyze_purchase_files", { templates }),
  applyMapping: (candidate: PurchaseMappingCandidate, selectedHeaderRow: number, mapping: PurchaseColumnMapping): Promise<PurchaseAnalysisResult> => invoke("apply_purchase_column_mapping", { candidate, selectedHeaderRow, mapping }),
  export: (format: "xlsx" | "csv", items: readonly PurchaseItem[], columns: readonly PurchaseOutputColumnId[]): Promise<boolean> => invoke("save_purchase_export", { format, items: items.filter((item) => item.selected), columns }),
  exportEdufine: (items: readonly PurchaseItem[]): Promise<boolean> => invoke("save_purchase_edufine_export", { items: items.filter((item) => item.selected) }),
  exportSettlement: (rows: readonly PurchaseSettlementExportRow[], summary: PurchaseSettlementSummary): Promise<boolean> => invoke("save_purchase_settlement_export", { rows, summary }),
} as const;
