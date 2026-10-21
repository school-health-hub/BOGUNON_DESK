// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Phase2Workspace } from "./Phase2Workspace";
import { emptyPhase2Data, type Phase2Data } from "./domain";

const value = (): Phase2Data => ({
  ...emptyPhase2Data(),
  investmentAccounts: [{ id: "account", name: "합성 계좌", market: "kr", currency: "KRW" }],
  instruments: [{ id: "instrument", accountId: "account", symbol: "QA001", name: "합성 종목", kind: "stock", currency: "KRW", marketPriceMinor: 100, valuationExchangeRateMicros: 1_000_000, valuedOn: "2026-01-01" }],
});
const cases = [
  ["증권계좌", "투자", "investmentAccounts", { name: "합성 새 계좌" }],
  ["보유 종목", "투자", "instruments", { accountId: "account", symbol: "QA002", name: "합성 새 종목", price: "100" }],
  ["매수·매도", "투자", "trades", { instrumentId: "instrument", quantity: "1", price: "100" }],
  ["배당", "투자", "dividends", { instrumentId: "instrument", gross: "100" }],
  ["현금·예금·적금", "자산", "assetBalances", { label: "합성 예금", amount: "100" }],
  ["대출·채무", "자산", "liabilities", { label: "합성 부채", amount: "100" }],
] satisfies readonly (readonly [string, string, keyof Phase2Data, Readonly<Record<string, string>>])[];

function fill(title: string, fields: Readonly<Record<string, string>>) {
  const investmentView = title === "증권계좌" || title === "보유 종목" ? "계좌·종목 설정" : title === "매수·매도" ? "거래 내역" : title === "배당" ? "배당" : null;
  if (investmentView) fireEvent.click(screen.getByRole("button", { name: investmentView }));
  const panel = screen.getByRole("heading", { name: title }).closest("section");
  const open = panel?.querySelector("header button");
  if (open instanceof HTMLButtonElement) fireEvent.click(open);
  const form = panel?.querySelector("form");
  if (!(form instanceof HTMLFormElement)) throw new Error("Synthetic form missing");
  for (const [name, next] of Object.entries(fields)) {
    const control = form.elements.namedItem(name);
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) throw new Error("Synthetic input missing");
    fireEvent.change(control, { target: { value: next } });
  }
  return form;
}
afterEach(cleanup);

describe("Phase 2 asynchronous form completion", () => {
  it("exposes the four investment views and accessible editor controls", () => {
    render(<Phase2Workspace income={[]} value={value()} disabled={false} onSave={vi.fn()} initialSection="investments" />);
    for (const name of ["보유 현황", "거래 내역", "배당", "계좌·종목 설정"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "계좌·종목 설정" }));
    fireEvent.click(screen.getByRole("heading", { name: "증권계좌" }).closest("section")!.querySelector("header button")!);
    expect(screen.getByRole("textbox", { name: "계좌 이름" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "시장 구분" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "계좌 통화" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
  });
  it("preserves a dirty investment editor when an inner tab change is cancelled", () => {
    render(<Phase2Workspace income={[]} value={value()} disabled={false} onSave={vi.fn()} initialSection="investments" />);
    fireEvent.click(screen.getByRole("button", { name: "계좌·종목 설정" }));
    const form = fill("증권계좌", { name: "합성 작성 중" });
    fireEvent.click(screen.getByRole("button", { name: "보유 현황" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "취소" }));
    expect(within(form).getByRole("textbox", { name: "계좌 이름" })).toHaveProperty("value", "합성 작성 중");
    expect(screen.getByRole("button", { name: "계좌·종목 설정" }).getAttribute("aria-current")).toBe("page");
  });
  it("keeps dirty state and values when the active editor add button is clicked again", () => {
    render(<Phase2Workspace income={[]} value={value()} disabled={false} onSave={vi.fn()} initialSection="investments" />);
    fireEvent.click(screen.getByRole("button", { name: "계좌·종목 설정" }));
    const form = fill("증권계좌", { name: "합성 유지" });
    const panel = screen.getByRole("heading", { name: "증권계좌" }).closest("section")!;
    fireEvent.click(within(panel).getAllByRole("button", { name: "추가" })[0]);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(within(form).getByRole("textbox", { name: "계좌 이름" })).toHaveProperty("value", "합성 유지");
    fireEvent.click(screen.getByRole("button", { name: "보유 현황" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it.each(cases)("resets %s only after a successful delayed save without a false failure", async (title, tab, key, fields) => {
    // Given a real rendered form and an unresolved save.
    let finish: (() => void) | undefined;
    const save = vi.fn((_next: Phase2Data) => new Promise<void>((resolve) => { finish = resolve; }));
    render(<Phase2Workspace income={[]} value={value()} disabled={false} onSave={save} />);
    fireEvent.click(screen.getByRole("button", { name: tab }));
    const form = fill(title, fields);
    const reset = vi.spyOn(form, "reset");
    // When the submit returns to React before persistence completes.
    fireEvent.submit(form);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0][key]).toHaveLength(value()[key].length + 1);
    expect(reset).not.toHaveBeenCalled();
    await act(async () => { if (!finish) throw new Error("Save not started"); finish(); });
    // Then successful persistence is not reported as a failure.
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("retains failed input and clears its transient error only after a fresh snapshot", async () => {
    // Given a failed save, not a successful persistence result.
    const current = value();
    const save = vi.fn().mockRejectedValue(new Error("SYNTHETIC_CAS_CONFLICT"));
    const ui = render(<Phase2Workspace income={[]} value={current} disabled={false} onSave={save} />);
    fireEvent.click(screen.getByRole("button", { name: "투자" }));
    const form = fill("증권계좌", { name: "합성 미저장" });
    // When the native boundary rejects the request.
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByRole("alert").textContent).toContain("저장하지 못했습니다");
    expect(screen.getByPlaceholderText("계좌 이름")).toHaveProperty("value", "합성 미저장");
    expect(document.body.textContent).not.toContain("SYNTHETIC_CAS_CONFLICT");
    ui.rerender(<Phase2Workspace income={[]} value={current} disabled onSave={save} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    // Then an explicitly refreshed snapshot clears stale feedback, not the input.
    ui.rerender(<Phase2Workspace income={[]} value={value()} disabled={false} onSave={save} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(within(form).getByPlaceholderText("계좌 이름")).toHaveProperty("value", "합성 미저장");
    expect(save).toHaveBeenCalledTimes(1);
  });
});
