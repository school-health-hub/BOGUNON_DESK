// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InventoryManagementPanel } from "../renderer/inventory-preview/source/InventoryManagementPanel";
import { createSyntheticInventoryAdapter } from "../renderer/inventory-preview/source/syntheticAdapter";

afterEach(cleanup);

const renderPanel = (props: Partial<React.ComponentProps<typeof InventoryManagementPanel>> = {}) =>
  render(<InventoryManagementPanel onClose={vi.fn()} {...props} />);

describe("InventoryManagementPanel", () => {
  it("loads the default synthetic workspace only once across local rerenders", async () => {
    const adapter = createSyntheticInventoryAdapter();
    const loadWorkspace = vi.fn(adapter.loadWorkspace);
    const adapterWithSpy = { ...adapter, loadWorkspace };
    const { rerender } = render(
      <InventoryManagementPanel onClose={vi.fn()} adapter={adapterWithSpy} />,
    );

    await screen.findByRole("table");
    rerender(<InventoryManagementPanel onClose={vi.fn()} adapter={adapterWithSpy} />);
    await waitFor(() => expect(loadWorkspace).toHaveBeenCalledTimes(1));
  });

  it("renders the synthetic boundary, summary, list, and selected item detail", async () => {
    renderPanel();
    expect(await screen.findByText("합성 데이터 전용 화면")).toBeTruthy();
    expect(screen.getByText(/실제 학교 재고나 서버에는 저장되지 않습니다/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "재고 요약" })).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("complementary", { name: /합성 멸균 거즈 상세/ })).toBeTruthy();
    expect(screen.getByText("가용재고")).toBeTruthy();
    expect(screen.getByText("격리")).toBeTruthy();
  });

  it("searches and filters without losing the explicit no-result state", async () => {
    renderPanel();
    await screen.findByRole("table");
    fireEvent.change(screen.getByRole("textbox", { name: "물품 검색" }), { target: { value: "탄력" } });
    expect(screen.getByRole("button", { name: "합성 탄력 붕대" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "합성 멸균 거즈" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "물품 검색" }), { target: { value: "없는 물품" } });
    expect(screen.getByText("검색 결과가 없습니다.")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "물품 검색" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "재고 상태 필터" }), { target: { value: "expired" } });
    expect(screen.getByRole("button", { name: "합성 냉각 패드" })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "합성 냉각 패드 상세" })).toBeTruthy();
    expect(screen.queryByRole("complementary", { name: "합성 멸균 거즈 상세" })).toBeNull();
  });

  it.each([
    ["permission", "접근 권한이 없습니다."],
    ["error", "목록을 불러오지 못했습니다."],
    ["empty", "등록된 물품이 없습니다."],
    ["loading", "합성 물품 목록을 불러오는 중입니다."],
  ] as const)("renders the %s state", (initialViewState, text) => {
    renderPanel({ initialViewState });
    expect(screen.getByText(text)).toBeTruthy();
  });

  it("previews a use request without presenting an operating save success", async () => {
    renderPanel();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "재고 사용 기록" }));
    const dialog = screen.getByRole("dialog", { name: "재고 사용 기록" });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "수량" }), { target: { value: "2" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "사용 메모" }), { target: { value: "합성 미리보기" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "입력 내용 확인" }));
    expect((await within(dialog).findByRole("status")).textContent).toContain("실제 재고에는 반영되지 않습니다");
    expect(dialog.textContent).not.toMatch(/저장되었습니다|저장 완료|입고 완료/);
  });

  it("blocks over-disposal and requires an audit reason", async () => {
    renderPanel();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "폐기" }));
    const dialog = screen.getByRole("dialog", { name: "폐기 기록" });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "수량" }), { target: { value: "11" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "업무 사유" }), { target: { value: "합성 폐기" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "입력 내용 확인" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("초과할 수 없습니다");
    expect(within(dialog).getByRole("textbox", { name: "업무 사유" }).hasAttribute("required")).toBe(true);
  });

  it("opens every workflow and closes with Escape", async () => {
    renderPanel();
    await screen.findByRole("table");
    for (const [buttonName, dialogName] of [["물품 등록", "물품 등록"], ["입고 등록", "입고 등록"], ["구매 필요 품목 확인", "구매 후보 확인"], ["재고 정정", "재고 정정"]] as const) {
      const invoker = screen.getByRole("button", { name: buttonName });
      invoker.focus();
      fireEvent.click(invoker);
      expect(screen.getByRole("dialog", { name: dialogName })).toBeTruthy();
      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog", { name: dialogName })).toBeNull());
      expect(document.activeElement).toBe(invoker);
    }
  });

  it("traps Tab focus inside a workflow dialog", async () => {
    renderPanel();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "입고 등록" }));
    const dialog = screen.getByRole("dialog", { name: "입고 등록" });
    const buttons = within(dialog).getAllByRole("button");
    const last = buttons[buttons.length - 1]!;
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("keeps reverse Tab inside the dialog from its initially focused heading", async () => {
    renderPanel();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "입고 등록" }));
    const dialog = screen.getByRole("dialog", { name: "입고 등록" });
    expect(document.activeElement).toBe(within(dialog).getByRole("heading", { name: "입고 등록" }));
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    const buttons = within(dialog).getAllByRole("button");
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it("turns adapter load rejection into the network error state", async () => {
    const adapter = createSyntheticInventoryAdapter();
    renderPanel({ adapter: { ...adapter, loadWorkspace: async () => { throw new Error("offline"); } } });
    expect(await screen.findByText("목록을 불러오지 못했습니다.")).toBeTruthy();
  });

  it("preserves registration, receipt, and purchase fields in preview drafts", async () => {
    const base = createSyntheticInventoryAdapter();
    const previewMutation = vi.fn(base.previewMutation);
    renderPanel({ adapter: { ...base, previewMutation } });
    await screen.findByRole("table");

    fireEvent.click(screen.getByRole("button", { name: "물품 등록" }));
    let dialog = screen.getByRole("dialog", { name: "물품 등록" });
    for (const [name, value] of [["물품명", "합성 신규품"], ["분류", "합성분류"], ["규격", "합성규격"], ["기본단위", "개"], ["구매단위", "상자"]]) fireEvent.change(within(dialog).getByRole("textbox", { name }), { target: { value } });
    for (const [name, value] of [["포장 변환비", "10"], ["권장재고", "20"], ["최소재고", "5"]]) fireEvent.change(within(dialog).getByRole("spinbutton", { name }), { target: { value } });
    fireEvent.click(within(dialog).getByRole("button", { name: "입력 내용 확인" }));
    await waitFor(() => expect(previewMutation).toHaveBeenLastCalledWith(expect.objectContaining({ specification: "합성규격", purchaseUnit: "상자", baseUnitsPerPurchaseUnit: 10, recommendedStock: 20, minimumStock: 5 })));
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "입고 등록" }));
    dialog = screen.getByRole("dialog", { name: "입고 등록" });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "수량" }), { target: { value: "2" } });
    fireEvent.change(within(dialog).getByLabelText("입고일"), { target: { value: "2026-11-02" } });
    fireEvent.change(within(dialog).getByLabelText("유효기간"), { target: { value: "2027-11-02" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "입력 내용 확인" }));
    await waitFor(() => expect(previewMutation).toHaveBeenLastCalledWith(expect.objectContaining({ receivedOn: "2026-11-02", expiresOn: "2027-11-02" })));
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "구매 필요 품목 확인" }));
    dialog = screen.getByRole("dialog", { name: "구매 후보 확인" });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "구매 수량" }), { target: { value: "3" } });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "예상 단가" }), { target: { value: "1200" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "입력 내용 확인" }));
    await waitFor(() => expect(previewMutation).toHaveBeenLastCalledWith(expect.objectContaining({ purchaseQuantity: 3, estimatedUnitPrice: 1200 })));
  });
});
