import { useEffect, useRef, useState } from 'react';
import type { PurchaseItem, PurchaseOutputColumnId, PurchaseSettlement } from './types';
import { createPurchaseClipboard } from './purchaseClipboard';
import { calculatePurchaseSettlementSummary, calculatePurchaseSettlementDisplaySummary, createPurchaseSettlementClipboard, createPurchaseSettlementExportRows, createPurchaseSettlementSummaryText, purchaseTaxModeLabels } from './purchaseSettlement';
import { selectedPurchaseTotal } from './purchaseDomain';
import { createPreviewContextKey, previewBlockReasons, type PurchaseOutputPreviewKind, type PurchaseOutputPreviewSnapshot, type PreviewTable } from './purchaseOutputPreview';
import { purchasePreviewRepository } from './purchasePreviewRepository';

type Options = {
  readonly items: readonly PurchaseItem[];
  readonly columns: readonly PurchaseOutputColumnId[];
  readonly settlement?: PurchaseSettlement;
  readonly revision?: number;
  readonly hiddenCount?: number;
  readonly format?: PurchaseOutputPreviewKind;
  readonly onNotice: (message: string) => void;
  readonly output: (kind: PurchaseOutputPreviewKind) => Promise<void>;
};
const money = (value: number) => `${value.toLocaleString('ko-KR')}원`;
export function usePurchaseOutputPreview(options: Options) {
  const [snapshot, setSnapshot] = useState<PurchaseOutputPreviewSnapshot | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [outputting, setOutputting] = useState(false);
  const outputLock = useRef(false);
  const token = useRef(0);
  const latest = useRef(options);
  latest.current = options;
  const contextKey = JSON.stringify([createPreviewContextKey(options.items, options.columns, options.settlement ?? null, options.revision), options.format, options.hiddenCount]);
  const contextVersion = useRef({ key: contextKey, version: 0 });
  if (contextVersion.current.key !== contextKey) contextVersion.current = { key: contextKey, version: contextVersion.current.version + 1 };
  const currentKey = JSON.stringify([contextKey, contextVersion.current.version]);
  const keyRef = useRef(currentKey);
  keyRef.current = currentKey;
  useEffect(() => () => { token.current++; }, []);
  const open = async (kind: PurchaseOutputPreviewKind) => {
    const request = ++token.current;
    const startKey = keyRef.current;
    const { items, columns, settlement, hiddenCount = 0 } = latest.current;
    const selectedCount = items.filter((item) => item.selected).length;
    const settlementOutput = kind.startsWith('settlement-');
    const blocked = previewBlockReasons(items, settlement, settlementOutput);
    const guidance = [{ name: '품의 예상금액', value: money(selectedPurchaseTotal(items)) }];
    if (settlement !== undefined) {
      const summary = calculatePurchaseSettlementSummary(items, settlement);
      const display = calculatePurchaseSettlementDisplaySummary(items, settlement);
      guidance.push(...[
        { name: '상품 실제금액', value: money(summary.actualSubtotal) },
        { name: '배송비', value: money(summary.shippingFee) }, { name: '할인', value: money(summary.discountAmount) },
        { name: '기존 정산 출력 금액', value: money(summary.finalActual) }, { name: '기존 정산 차액', value: money(summary.difference) },
        { name: '별도 부가세 적용액', value: money(display.appliedTaxAmount) },
        { name: '화면 최종금액', value: money(display.screenFinalActual) },
        { name: '세액 처리', value: `${purchaseTaxModeLabels[display.tax.mode]} · 새 세액 계산이나 보정 없이 기존 계산 결과를 표시합니다.` },
      ]);
    } else guidance.push({ name: '금액 기준', value: '수량×단가 및 원본 금액 확인은 기존 검산 기준입니다. 배송비·할인·구매 후 실제금액은 구매결과에서 확인합니다.' });
    if (kind === 'csv') guidance.push({ name: 'CSV 기준', value: 'UTF-8 BOM 유지 · 수식 시작 문자에는 기존 보호 처리가 적용됩니다.' });
    if (kind === 'clipboard' || kind === 'settlement-clipboard') guidance.push({ name: '클립보드 기준', value: '텍스트 표 기준입니다. 탭과 줄바꿈은 기존 규칙대로 공백으로 바뀝니다. HTML 표 복사도 기존 형식을 유지합니다.' });
    if (kind === 'edufine') guidance.push({ name: '에듀파인 기준', value: '내용·규격·수량·예상단가 고정 4열입니다. 실제 에듀파인 반입 성공을 의미하지 않습니다.' });
    setPreparing(true);
    try {
      let result: PreviewTable = { headers: [], rows: [] };
      if (blocked.length === 0) {
        switch (kind) {
          case 'clipboard': { const content = createPurchaseClipboard(items, columns); result = { headers: content.headers, rows: content.textRows }; break; }
          case 'csv': case 'xlsx': case 'edufine': result = await purchasePreviewRepository.general(kind, items, columns); break;
          case 'settlement-clipboard': if (settlement !== undefined) { const content = createPurchaseSettlementClipboard(items, settlement); result = { headers: content.headers, rows: content.textRows }; } break;
          case 'settlement-summary': if (settlement !== undefined) result = { headers: ['기존 정산 요약'], rows: createPurchaseSettlementSummaryText(calculatePurchaseSettlementSummary(items, settlement)).split('\n').map((line) => [line]) }; break;
          case 'settlement-xlsx': if (settlement !== undefined) {
            const content = await purchasePreviewRepository.settlement(createPurchaseSettlementExportRows(items, settlement), calculatePurchaseSettlementSummary(items, settlement));
            result = content.preview;
            guidance.push(...content.summary.rows.map((row) => ({ name: String(row[0]), value: String(row[1]) })));
          } break;
        }
      }
      if (request === token.current) setSnapshot({ kind, table: result, key: startKey, selectedCount, hiddenCount, plannedTotal: selectedPurchaseTotal(items), guidance, blocked });
      if (startKey !== keyRef.current) latest.current.onNotice('준비 중 데이터가 변경되어 이전 미리보기의 출력을 차단했습니다. 다시 열어 주세요.');
    } catch (error: unknown) {
      if (request === token.current) latest.current.onNotice(error instanceof Error ? error.message : '출력 미리보기를 준비하지 못했습니다.');
    } finally { if (request === token.current) setPreparing(false); }
  };
  const output = async () => {
    if (snapshot === null || outputLock.current) return;
    if (snapshot.key !== keyRef.current || snapshot.blocked.length !== 0) { latest.current.onNotice('오래되었거나 차단된 미리보기로 출력할 수 없습니다. 다시 확인해 주세요.'); return; }
    outputLock.current = true;
    const request = token.current;
    setOutputting(true);
    try { await latest.current.output(snapshot.kind); if (request === token.current) setSnapshot(null); }
    finally { outputLock.current = false; setOutputting(false); }
  };
  return { snapshot, currentKey, preparing, outputting, open, output, close: () => { token.current++; setPreparing(false); setSnapshot(null); } };
}
