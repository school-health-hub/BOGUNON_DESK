// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createEmptyPurchaseItem } from "./purchaseDomain";
import { usePurchaseItemEditing } from "./usePurchaseItemEditing";

function Harness({ open }: { readonly open: boolean }) {
  const [editing, dispatch] = usePurchaseItemEditing(open);
  return <>
    <output aria-label="Undo 상태">{editing.undo === null ? "없음" : "가능"}</output>
    <output aria-label="품목 상태">{editing.items.map((item) => `${item.id}:${item.vendor}`).join(",")}</output>
    <button onClick={() => dispatch({ type: "append", items: [createEmptyPurchaseItem("a")] })}>품목 준비</button>
    <button onClick={() => dispatch({ type: "bulk", request: { revision: editing.revision, selectedIds: ["a"], edits: { vendor: { mode: "set", value: "상점" }, budgetItem: { mode: "keep" } } } })}>일괄 적용</button>
    <button onClick={() => {
      dispatch({ type: "append", items: [createEmptyPurchaseItem("b")] });
      dispatch({ type: "bulk", request: { revision: editing.revision, selectedIds: ["a"], edits: { vendor: { mode: "set", value: "오래된 값" }, budgetItem: { mode: "keep" } } } });
    }}>같은 이벤트의 가져오기와 오래된 적용</button>
  </>;
}
describe("Purchase owner hook lifecycle", () => {
  afterEach(cleanup);
  it("invalidates undo on navigation closure while preserving items after reopening", () => {
    const { rerender } = render(<Harness open />);
    fireEvent.click(screen.getByText("품목 준비"));
    fireEvent.click(screen.getByText("일괄 적용"));
    expect(screen.getByLabelText("Undo 상태").textContent).toBe("가능");
    rerender(<Harness open={false} />);
    rerender(<Harness open />);
    expect(screen.getByLabelText("Undo 상태").textContent).toBe("없음");
    expect(screen.getByLabelText("품목 상태").textContent).toBe("a:상점");
  });
  it("keeps new imports when a stale batch is queued in the same event", () => {
    render(<Harness open />);
    fireEvent.click(screen.getByText("품목 준비"));
    fireEvent.click(screen.getByText("같은 이벤트의 가져오기와 오래된 적용"));
    expect(screen.getByLabelText("품목 상태").textContent).toBe("a:,b:");
    expect(screen.getByLabelText("Undo 상태").textContent).toBe("없음");
  });
});
