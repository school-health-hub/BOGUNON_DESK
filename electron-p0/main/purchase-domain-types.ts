export type {PurchaseAmountCheck,PurchaseItem,PurchaseIssue,PurchaseOutputColumnId,PurchaseOutputReadiness} from '../renderer/purchase/purchase/types.js';
export const purchaseOutputColumnIds = ["number", "name", "specification", "quantity", "unitPrice", "amount", "vendor", "note", "budgetItem"] as const;
export const defaultPurchaseOutputColumns = ["number", "name", "specification", "quantity", "unitPrice", "amount", "note"] as const;
export const purchaseOutputColumnLabels = {number:'번호',name:'품명',specification:'규격',quantity:'수량',unitPrice:'단가',amount:'금액',vendor:'구매처',note:'비고',budgetItem:'예산항목'} as const;
