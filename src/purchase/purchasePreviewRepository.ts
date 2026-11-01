import { invoke } from '@tauri-apps/api/core';
import type { PurchaseItem, PurchaseOutputColumnId, PurchaseSettlementExportRow, PurchaseSettlementSummary } from './types';
import type { PreviewTable } from './purchaseOutputPreview';

function table(value: unknown): PreviewTable {
  if (typeof value !== 'object' || value === null || !('headers' in value) || !('rows' in value)
    || !Array.isArray(value.headers) || !value.headers.every((cell: unknown) => typeof cell === 'string')
    || !Array.isArray(value.rows)) throw new Error('미리보기 응답을 확인하지 못했습니다.');
  const headers: string[] = value.headers;
  const rows: (string | number | null)[][] = [];
  for (const candidate of value.rows) {
    if (!Array.isArray(candidate) || candidate.length !== headers.length
      || !candidate.every((cell: unknown) => cell === null || typeof cell === 'string' || (typeof cell === 'number' && Number.isFinite(cell)))) throw new Error('미리보기 셀 형식이 올바르지 않습니다.');
    rows.push(candidate);
  }
  return { headers, rows };
}
export const purchasePreviewRepository = {
  general: async (format: 'csv' | 'xlsx' | 'edufine', items: readonly PurchaseItem[], columns: readonly PurchaseOutputColumnId[]) =>
    table(await invoke<unknown>('preview_purchase_export', { format, items, columns })),
  settlement: async (rows: readonly PurchaseSettlementExportRow[], summary: PurchaseSettlementSummary) => {
    const result = await invoke<unknown>('preview_purchase_settlement_export', { rows, summary });
    const preview = table(result);
    if (typeof result !== 'object' || result === null || !('summaryRows' in result) || !Array.isArray(result.summaryRows)) throw new Error('정산 미리보기 요약이 없습니다.');
    const summaryRows: (string | number | null)[][] = [];
    for (const row of result.summaryRows) {
      if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'string' || typeof row[1] !== 'number' || !Number.isFinite(row[1])) throw new Error('정산 요약 형식이 올바르지 않습니다.');
      summaryRows.push(row);
    }
    return { preview, summary: { headers: ['정산 항목', '기존 출력 금액'], rows: summaryRows } };
  },
};
