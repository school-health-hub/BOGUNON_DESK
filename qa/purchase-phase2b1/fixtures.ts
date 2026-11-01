import { createEmptyPurchaseItem, withPurchaseIssues } from '../../src/purchase/purchaseDomain';

export function syntheticItems(count = 3) {
  return Array.from({ length: count }, (_, index) => {
    const suffix = index < 3 ? ['A', 'B', 'C'][index] : String(index + 1);
    return withPurchaseIssues({
      ...createEmptyPurchaseItem(`qa-${index + 1}`),
      name: count > 3 && index === count - 1 ? '' : `합성 품목 ${suffix}`,
      quantity: 1, unitPrice: 10, importedAmount: index < 2 ? 20 : 10,
      vendor: `구매처 ${suffix}`, budgetItem: `예산 ${suffix}`,
      note: '합성 QA 데이터',
    });
  });
}
