import type { PurchaseEditingState } from '../../src/purchase/purchaseItemEditing';

export type PurchaseQaState = PurchaseEditingState & {
  readonly panelOpen: boolean;
  readonly faultInjection: boolean;
};
export type PurchaseQaController = {
  readonly getState: () => PurchaseQaState;
  readonly act: (action: string) => void;
};
declare global {
  interface Window { purchaseQa: PurchaseQaController }
}
