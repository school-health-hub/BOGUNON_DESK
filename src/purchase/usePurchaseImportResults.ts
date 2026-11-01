import { useCallback, useState } from "react";
import { mergePurchaseImportCandidates, mergePurchaseImportSources } from "./purchaseImportSession";
import type { PurchaseAnalysisResult, PurchaseItem, PurchaseMappingCandidate, PurchaseSourceSummary } from "./types";

export function usePurchaseImportResults(appendItems: (items: readonly PurchaseItem[]) => void) {
  const [sources, setSources] = useState<readonly PurchaseSourceSummary[]>([]);
  const [candidates, setCandidates] = useState<readonly PurchaseMappingCandidate[]>([]);
  const append = useCallback((result: PurchaseAnalysisResult) => {
    appendItems(result.items);
    setSources((current) => mergePurchaseImportSources(current, result.sources));
    setCandidates((current) => mergePurchaseImportCandidates(current, result));
  }, [appendItems]);
  return { sources, candidates, setSources, setCandidates, append };
}
