// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyPurchaseItem, withPurchaseIssues } from './purchaseDomain';
import { createPurchaseClipboard } from './purchaseClipboard';
import { purchasePreviewRepository } from './purchasePreviewRepository';
import { createPurchaseSettlement } from './purchaseSettlement';
import { usePurchaseOutputPreview } from './usePurchaseOutputPreview';
import type { PreviewTable } from './purchaseOutputPreview';
import type { PurchaseItem, PurchaseOutputColumnId } from './types';

vi.mock('./purchasePreviewRepository', () => ({ purchasePreviewRepository: { general: vi.fn(), settlement: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const items = ['a', 'b', 'c'].map((id) => withPurchaseIssues({ ...createEmptyPurchaseItem(id), name: `합성 ${id}`, quantity: 2, unitPrice: 100 }));
const columns: readonly PurchaseOutputColumnId[] = ['name', 'quantity', 'amount'];
function setup(initial: readonly PurchaseItem[] = items) {
  const output = vi.fn(async () => undefined);
  const onNotice = vi.fn();
  const hook = renderHook(({ data, revision }) => usePurchaseOutputPreview({ items: data, columns, revision, hiddenCount: 1, output, onNotice }), { initialProps: { data: initial, revision: 0 } });
  return { ...hook, output, onNotice };
}
describe('purchase output preview owner integration', () => {
  it.each([
    ['unspecified', '세액 미지정'], ['included', '세액 포함'],
    ['excluded', '세액 별도'], ['exempt', '면세'],
  ] as const)('shows Korean guidance for %s without changing stored tax values', async (mode, label) => {
    const settlement = { ...createPurchaseSettlement(items), tax: { mode, amount: 0 } };
    const before = JSON.stringify(settlement);
    const { result } = renderHook(() => usePurchaseOutputPreview({ items, columns, settlement, onNotice: vi.fn(), output: vi.fn(async () => undefined) }));
    await act(async () => { await result.current.open('settlement-clipboard'); });
    const guidance = result.current.snapshot?.guidance.find((entry) => entry.name === '세액 처리');
    expect(guidance?.value).toBe(`${label} · 새 세액 계산이나 보정 없이 기존 계산 결과를 표시합니다.`);
    expect(guidance?.value).not.toContain(mode);
    expect(JSON.stringify(settlement)).toBe(before);
    expect(result.current.snapshot?.table.rows).toHaveLength(3);
  });
  it('uses exact existing clipboard cells including hidden selected rows', async () => {
    const { result, output } = setup();
    await act(async () => { await result.current.open('clipboard'); });
    const content = createPurchaseClipboard(items, columns);
    expect(result.current.snapshot?.table).toEqual({ headers: content.headers, rows: content.textRows });
    expect(result.current.snapshot).toMatchObject({ selectedCount: 3, hiddenCount: 1 });
    await act(async () => { await result.current.output(); });
    expect(output).toHaveBeenCalledExactlyOnceWith('clipboard');
  });
  it('blocks changed and reverted data by revision without invoking output', async () => {
    const { result, rerender, output } = setup();
    await act(async () => { await result.current.open('clipboard'); });
    rerender({ data: [{ ...items[0], name: '수정' }, ...items.slice(1)], revision: 1 });
    rerender({ data: items, revision: 2 });
    await act(async () => { await result.current.output(); });
    expect(output).not.toHaveBeenCalled();
    expect(result.current.snapshot?.key).not.toBe(result.current.currentKey);
  });
  it('rejects an asynchronously prepared native preview after owner replacement', async () => {
    let resolve: (table: PreviewTable) => void = () => undefined;
    vi.mocked(purchasePreviewRepository.general).mockReturnValueOnce(new Promise<PreviewTable>((done) => { resolve = done; }));
    const { result, rerender, output } = setup();
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.open('xlsx'); });
    rerender({ data: [], revision: 1 });
    await act(async () => { resolve({ headers: ['내용'], rows: [['이전 데이터']] }); await pending; });
    await act(async () => { await result.current.output(); });
    expect(output).not.toHaveBeenCalled();
  });
  it('does not prepare or emit output when selection is empty', async () => {
    const { result, output } = setup(items.map((item) => ({ ...item, selected: false })));
    await act(async () => { await result.current.open('csv'); await result.current.output(); });
    expect(result.current.snapshot?.blocked.length).toBeGreaterThan(0);
    expect(purchasePreviewRepository.general).not.toHaveBeenCalled();
    expect(output).not.toHaveBeenCalled();
  });
});
