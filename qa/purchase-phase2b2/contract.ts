import type { PurchaseAnalysisResult, PurchaseImportTemplate } from '../../src/purchase/types';
import type { MappingFixtures } from './mapping-fixtures';
import type { PurchaseEditingState } from '../../src/purchase/purchaseItemEditing';

export type PurchaseQaState = PurchaseEditingState & {
  readonly panelOpen: boolean;
  readonly faultInjection: boolean;
  readonly mapping: { readonly sources: PurchaseAnalysisResult['sources']; readonly candidates: PurchaseAnalysisResult['candidates']; readonly templates: readonly PurchaseImportTemplate[]; readonly notice: string };
  readonly requests: readonly { readonly id: number; readonly candidateId: string; readonly headerRow: number }[];
};
export type PurchaseQaController = {
  readonly getState: () => PurchaseQaState;
  readonly act: (action: string) => void;
  readonly fixture: (kind: keyof MappingFixtures) => MappingFixtures[keyof MappingFixtures];
  readonly complete: (id: number, failure?: boolean) => void;
};
declare global {
  interface Window { purchaseQa: PurchaseQaController }
}
