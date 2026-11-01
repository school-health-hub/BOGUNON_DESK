import { useEffect, useReducer } from "react";
import { createPurchaseEditingState, purchaseItemEditingReducer } from "./purchaseItemEditing";

export function usePurchaseItemEditing(panelOpen: boolean) {
  const [editing, dispatch] = useReducer(purchaseItemEditingReducer, undefined, () => createPurchaseEditingState());
  useEffect(() => {
    if (!panelOpen && editing.undo !== null) dispatch({ type: "invalidate", reason: "패널을 닫아" });
  }, [panelOpen, editing.undo]);
  return [editing, dispatch] as const;
}
