import { useEffect, useRef, useState, type FormEvent } from "react";
import type { InventoryItemView, InventoryMutationDraft, InventoryUiAdapter } from "./inventoryTypes";

export type InventoryWorkflow = InventoryMutationDraft["kind"];

const labels: Record<InventoryWorkflow, string> = {
  register_item: "물품 등록",
  receive: "입고 등록",
  use: "재고 사용 기록",
  dispose: "폐기 기록",
  adjust: "재고 정정",
  purchase_candidate: "구매 후보 확인",
};

type Props = {
  readonly workflow: InventoryWorkflow;
  readonly item: InventoryItemView | null;
  readonly adapter: InventoryUiAdapter;
  readonly onClose: () => void;
};

const numberValue = (data: FormData, key: string): number => Number(data.get(key));

export function InventoryWorkflowDialog({ workflow, item, adapter, onClose }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const invoker = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    headingRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const dialog = headingRef.current?.closest<HTMLElement>("[role=dialog]");
      const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")) : [];
      if (focusable.length === 0) return;
      const first = focusable[0]!; const last = focusable[focusable.length - 1]!;
      if (!focusable.includes(document.activeElement as HTMLElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); invoker?.focus(); };
  }, [onClose]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const itemId = item?.itemId ?? "";
    const lotId = String(data.get("lotId") ?? item?.lots[0]?.lotId ?? "");
    let draft: InventoryMutationDraft;
    if (workflow === "register_item") {
      draft = { kind: workflow, name: String(data.get("name") ?? ""), category: String(data.get("category") ?? ""), specification: String(data.get("specification") ?? ""), baseUnit: String(data.get("baseUnit") ?? ""), purchaseUnit: String(data.get("purchaseUnit") ?? ""), baseUnitsPerPurchaseUnit: numberValue(data, "conversion"), recommendedStock: numberValue(data, "recommended"), minimumStock: numberValue(data, "minimum") };
    } else if (workflow === "receive") {
      draft = { kind: workflow, itemId, purchaseQuantity: numberValue(data, "quantity"), baseUnitsPerPurchaseUnit: numberValue(data, "conversion"), receivedOn: String(data.get("receivedOn") ?? ""), expiresOn: String(data.get("expiresOn") ?? "").trim() || null };
    } else if (workflow === "use") {
      draft = { kind: workflow, itemId, quantity: numberValue(data, "quantity"), note: String(data.get("reason") ?? "") };
    } else if (workflow === "dispose") {
      draft = { kind: workflow, itemId, lotId, quantity: numberValue(data, "quantity"), reason: String(data.get("reason") ?? "") };
    } else if (workflow === "adjust") {
      draft = { kind: workflow, itemId, lotId, confirmedQuantity: numberValue(data, "quantity"), reason: String(data.get("reason") ?? "") };
    } else {
      draft = { kind: workflow, itemId, purchaseQuantity: numberValue(data, "quantity"), estimatedUnitPrice: numberValue(data, "estimatedPrice") };
    }

    const quantity = "quantity" in draft ? draft.quantity : "confirmedQuantity" in draft ? draft.confirmedQuantity : "purchaseQuantity" in draft ? draft.purchaseQuantity : 1;
    const selectedLot = item?.lots.find((lot) => lot.lotId === lotId);
    if ((workflow === "dispose" || workflow === "use") && selectedLot && quantity > selectedLot.remainingQuantity) {
      setError(`현재 로트 잔량 ${selectedLot.remainingQuantity}${item?.baseUnit ?? ""}을 초과할 수 없습니다.`);
      return;
    }
    if ((workflow === "dispose" || workflow === "adjust") && String(data.get("reason") ?? "").trim() === "") {
      setError("업무 사유를 입력해 주세요.");
      return;
    }
    const result = await adapter.previewMutation(draft);
    if (result.kind === "unavailable") setError(result.message);
    else setMessage(result.message);
  };

  const needsItem = workflow !== "register_item";
  const needsLot = workflow === "dispose" || workflow === "adjust";
  const quantityLabel = workflow === "adjust" ? "실사 확인 잔량" : workflow === "purchase_candidate" ? "구매 수량" : "수량";

  return (
    <div className="inventory-dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="inventory-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-workflow-title">
        <header><div><p className="inventory-eyebrow">합성 데이터 미리보기</p><h3 id="inventory-workflow-title" tabIndex={-1} ref={headingRef}>{labels[workflow]}</h3></div><button type="button" aria-label={`${labels[workflow]} 닫기`} onClick={onClose}>닫기</button></header>
        {needsItem && <p className="inventory-dialog__context"><strong>{item?.name ?? "선택된 물품 없음"}</strong><span>이 입력은 실제 재고에 반영되지 않습니다.</span></p>}
        <form onSubmit={(event) => void submit(event)}>
          {workflow === "register_item" ? <>
            <label>물품명<input name="name" required /></label><label>분류<input name="category" required /></label><label>규격<input name="specification" /></label><label>기본단위<input name="baseUnit" required /></label><label>구매단위<input name="purchaseUnit" /></label><label>포장 변환비<input name="conversion" type="number" min="1" step="1" /></label><label>권장재고<input name="recommended" type="number" min="0" step="1" /></label><label>최소재고<input name="minimum" type="number" min="0" step="1" /></label>
          </> : <>
            {needsLot && <label>로트<select name="lotId" defaultValue={item?.lots[0]?.lotId}>{item?.lots.map((lot) => <option key={lot.lotId} value={lot.lotId}>{lot.lotId} · 잔량 {lot.remainingQuantity}</option>)}</select></label>}
            <label>{quantityLabel}<input name="quantity" type="number" min={workflow === "adjust" ? "0" : "1"} step="1" required /></label>
            {workflow === "receive" && <><label>단위<input value={item?.purchaseUnit ?? ""} readOnly /></label><label>포장 변환비<input name="conversion" type="number" min="1" step="1" defaultValue={item?.baseUnitsPerPurchaseUnit} required /></label><label>입고일<input name="receivedOn" type="date" required /></label><label>유효기간<input name="expiresOn" type="date" /></label></>}
            {(workflow === "use" || workflow === "dispose" || workflow === "adjust") && <label className="inventory-dialog__wide">{workflow === "use" ? "사용 메모" : "업무 사유"}<textarea name="reason" rows={3} required /></label>}
            {workflow === "purchase_candidate" && <label>예상 단가<input name="estimatedPrice" type="number" min="0" step="1" /></label>}
          </>}
          {error && <p role="alert" className="inventory-form-message is-error">{error}</p>}
          {message && <p role="status" className="inventory-form-message">{message}</p>}
          <footer><button type="button" onClick={onClose}>취소</button><button className="is-primary" type="submit">입력 내용 확인</button></footer>
        </form>
      </section>
    </div>
  );
}
