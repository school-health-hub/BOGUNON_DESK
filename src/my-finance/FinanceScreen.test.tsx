// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FinanceScreen } from "./FinanceScreen";
import type { FinanceSnapshot } from "./repository";
import type { IncomeRecord } from "./domain";
import fixture from "./fixtures/cross-pc-synthetic.json";
const api = vi.hoisted(() => ({ listFinanceIncome: vi.fn(), createFinanceIncome: vi.fn(), updateFinanceIncome: vi.fn(), deleteFinanceIncome: vi.fn(), cancelFinanceBackup: vi.fn(), exportFinanceBackup: vi.fn(), selectFinanceBackup: vi.fn(), inspectFinanceBackup: vi.fn(), restoreFinanceBackup: vi.fn() }));
vi.mock("./repository", () => api);
const year = new Date().getFullYear();
const item: IncomeRecord = { id: "00000000-0000-4000-8000-000000000001", sourceName: "합성 지급처 A", incomeKind: "lecture", contractLabel: "합성 계약", taxCategory: "unverified", taxCategoryVerified: false, earnedOn: `${year}-01-10`, paidOn: null, grossKrw: 100_000, deductions: [{ kind: "income_tax", amountKrw: 3_000 }], netKrw: 97_000, notes: "합성 메모" };
const snapshot = (income: readonly IncomeRecord[] = [], revision = 1): FinanceSnapshot => ({ identity: { schemaVersion: 2, datasetId: "00000000-0000-4000-8000-000000000042", revision, history: Array.from({ length: revision }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`) }, income });
const confirmed = () => within(screen.getByRole("alertdialog")).getByRole("button", { name: "로컬 저장" });
const change = (name: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });
async function ready(data = snapshot()) { api.listFinanceIncome.mockResolvedValue(data); render(<FinanceScreen onClose={vi.fn()} />); await waitFor(() => expect(screen.getByRole("button", { name: "수입 등록" }).hasAttribute("disabled")).toBe(false)); }
async function newForm() { await ready(); fireEvent.click(screen.getByRole("button", { name: "수입 등록" })); change("지급처", "합성 새 지급처"); change(/^총수입 \(원\)/, "200000"); }

describe("local finance management", () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it("shows loading, a genuine empty store and the prerelease warning", async () => {
    let finish!: (data: FinanceSnapshot) => void;
    api.listFinanceIncome.mockReturnValue(new Promise((r) => { finish = r; }));
    render(<FinanceScreen onClose={vi.fn()} />);
    expect(screen.getByText("암호화 저장소를 불러오는 중입니다")).toBeTruthy();
    expect(screen.queryByText("아직 등록된 수입이 없습니다")).toBeNull();
    expect(screen.getByRole("button", { name: "수입 등록" }).hasAttribute("disabled")).toBe(true);
    await act(async () => finish(snapshot()));
    expect(screen.getByText("아직 등록된 수입이 없습니다")).toBeTruthy();
    expect(screen.getByText(/아직 실제 금융정보를 입력하지 마세요/)).toBeTruthy();
  });
  it("filters income and recomputes annual cards using occurrence dates", async () => {
    await ready(snapshot([item, { ...item, id: "synthetic-b", sourceName: "합성 전자책", incomeKind: "ebook", paidOn: `${year + 1}-01-01` }, { ...item, id: "synthetic-c", sourceName: "합성 이전 연도", earnedOn: `${year - 1}-12-31` }]));
    const cards = within(screen.getByRole("region", { name: "연간 수입 집계" }));
    expect(cards.getByText("200,000원")).toBeTruthy(); expect(cards.getByText("1건")).toBeTruthy();
    change("수입 유형 필터", "ebook");
    expect(cards.getByText("100,000원")).toBeTruthy(); expect(cards.getByText("0건")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "합성 지급처 A" })).toBeNull();
    change("연도", String(year - 1)); change("수입 유형 필터", "all");
    expect(screen.getByRole("heading", { name: "합성 이전 연도" })).toBeTruthy();
    expect(cards.getByText("1건")).toBeTruthy();
  });
  it("confirms creation, calculates net, sends the expected identity once and never uses remote/browser storage", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const network = vi.spyOn(globalThis, "fetch");
    await newForm();
    fireEvent.click(screen.getByRole("button", { name: /공제 추가/ }));
    change("공제 유형 1", "platform_fee"); change("공제 금액 1 (원)", "10000");
    expect(screen.getByLabelText("실수령액 미리보기").textContent).toBe("190,000원");
    fireEvent.click(screen.getByRole("button", { name: "등록 내용 확인" }));
    expect(api.createFinanceIncome).not.toHaveBeenCalled();
    let finish!: (data: FinanceSnapshot) => void;
    api.createFinanceIncome.mockImplementation((_identity, entry) => new Promise((resolve) => { finish = () => resolve(snapshot([entry], 2)); }));
    const confirmButton = confirmed(); fireEvent.click(confirmButton); fireEvent.click(confirmButton);
    expect(api.createFinanceIncome).toHaveBeenCalledTimes(1);
    expect(api.createFinanceIncome.mock.calls[0][0]).toEqual(snapshot().identity);
    expect(api.createFinanceIncome.mock.calls[0][1]).toMatchObject({ sourceName: "합성 새 지급처", grossKrw: 200000, netKrw: 190000, taxCategory: "unverified", taxCategoryVerified: false, deductions: [{ kind: "platform_fee", amountKrw: 10000 }] });
    await act(async () => finish(snapshot()));
    expect(screen.getByText("수입을 등록했습니다.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "합성 새 지급처" })).toBeTruthy();
    expect(storage).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled();
  });
  it("edits all fields through native CRUD without inferring a tax classification", async () => {
    await ready(snapshot([item]));
    fireEvent.click(screen.getByRole("button", { name: "수입 수정" }));
    change("지급처", "합성 수정 지급처"); change("수입 유형", "consulting"); change("계약 명목", "합성 자문");
    change("수입 발생일", `${year}-02-03`); change(/입금일 · 선택/, `${year}-03-04`);
    change(/^총수입 \(원\)/, "300000"); change("공제 금액 1 (원)", "6000"); change("메모 · 선택", "합성 수정 메모");
    expect(screen.getByLabelText("세무 분류")).toHaveProperty("value", "unverified");
    change("세무 분류", "business"); fireEvent.click(screen.getByLabelText("증빙을 확인해 세무 분류를 확정했습니다."));
    api.updateFinanceIncome.mockImplementation(async (_identity, entry) => snapshot([entry], 2));
    fireEvent.click(screen.getByRole("button", { name: "수정 내용 확인" })); fireEvent.click(confirmed());
    await screen.findByText("수입을 수정했습니다.");
    expect(api.updateFinanceIncome).toHaveBeenCalledWith(snapshot().identity, expect.objectContaining({ id: item.id, incomeKind: "consulting", taxCategory: "business", taxCategoryVerified: true, netKrw: 294000, paidOn: `${year}-03-04`, notes: "합성 수정 메모" }));
  });
  it("confirms deletion and preserves records when deletion is cancelled", async () => {
    await ready(snapshot([item]));
    fireEvent.click(screen.getByRole("button", { name: "수입 삭제" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "취소" }));
    expect(api.deleteFinanceIncome).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "수입 삭제" }));
    api.deleteFinanceIncome.mockResolvedValue(snapshot([], 2));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "삭제" }));
    await screen.findByText("수입을 삭제했습니다.");
    expect(api.deleteFinanceIncome).toHaveBeenCalledWith(snapshot().identity, item.id);
    expect(screen.getByText("아직 등록된 수입이 없습니다")).toBeTruthy();
  });
  it("rejects an over-deduction locally before any mutation", async () => {
    await newForm(); fireEvent.click(screen.getByRole("button", { name: /공제 추가/ })); change("공제 금액 1 (원)", "200001");
    fireEvent.click(screen.getByRole("button", { name: "등록 내용 확인" }));
    expect(screen.getByRole("alert").textContent).toContain("초과할 수 없습니다");
    expect(api.createFinanceIncome).not.toHaveBeenCalled(); expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("blocks stale edits, sanitizes errors and discards an old draft only after explicit refresh confirmation", async () => {
    await ready(snapshot([item])); fireEvent.click(screen.getByRole("button", { name: "수입 수정" })); change("지급처", "합성 이전 편집");
    api.updateFinanceIncome.mockRejectedValue("금융 데이터가 변경되었습니다. SYNTHETIC_PRIVATE_ERROR");
    fireEvent.click(screen.getByRole("button", { name: "수정 내용 확인" })); fireEvent.click(confirmed());
    await screen.findByText(/다른 작업에서 금융 데이터가 변경되었습니다/);
    expect(document.body.textContent).not.toContain("SYNTHETIC_PRIVATE_ERROR");
    expect(api.listFinanceIncome).toHaveBeenCalledTimes(1); expect(api.updateFinanceIncome).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "수정 내용 확인" }).hasAttribute("disabled")).toBe(true);
    api.listFinanceIncome.mockResolvedValue(snapshot([{ ...item, sourceName: "합성 외부 수정" }], 2));
    fireEvent.click(screen.getAllByRole("button", { name: "최신 목록 새로고침" })[0]);
    expect(screen.getByRole("alertdialog").textContent).toContain("작성 중인 내용을 버리고");
    expect(api.listFinanceIncome).toHaveBeenCalledTimes(1);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "확인" }));
    await screen.findByRole("heading", { name: "합성 외부 수정" });
    expect(screen.queryByLabelText("지급처")).toBeNull(); expect(api.updateFinanceIncome).toHaveBeenCalledTimes(1);
  });
  it("does not present a failed load as an empty balance or expose raw native errors", async () => {
    api.listFinanceIncome.mockRejectedValue(new Error("SYNTHETIC_PRIVATE_INPUT")); render(<FinanceScreen onClose={vi.fn()} />);
    await screen.findByRole("alert");
    expect(screen.queryByText("아직 등록된 수입이 없습니다")).toBeNull();
    expect(document.body.textContent).not.toContain("SYNTHETIC_PRIVATE_INPUT");
    expect(within(screen.getByRole("region", { name: "연간 수입 집계" })).queryByText("0원")).toBeNull();
  });
  it("asks before losing unsaved input when returning to school work", async () => {
    api.listFinanceIncome.mockResolvedValue(snapshot()); const close = vi.fn(); render(<FinanceScreen onClose={close} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "수입 등록" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "수입 등록" })); change("지급처", "합성 미저장");
    fireEvent.click(screen.getByRole("button", { name: "보건 업무로" })); expect(close).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "취소" }));
    expect(screen.getByLabelText("지급처")).toHaveProperty("value", "합성 미저장");
    fireEvent.click(screen.getByRole("button", { name: "보건 업무로" })); fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "확인" }));
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("keeps keyboard focus and draft when a save confirmation is cancelled", async () => {
    await newForm();
    const field = screen.getByLabelText("지급처"); field.focus();
    fireEvent.click(screen.getByRole("button", { name: "등록 내용 확인" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(field);
    expect(api.createFinanceIncome).not.toHaveBeenCalled();
  });
  it("paginates records without changing the annual summary", async () => {
    await ready(snapshot(Array.from({ length: 25 }, (_, i) => ({ ...item, id: `synthetic-${String(i).padStart(2, "0")}`, sourceName: `합성 지급처 ${i}` }))));
    expect(screen.getAllByRole("article")).toHaveLength(20);
    expect(within(screen.getByRole("region", { name: "연간 수입 집계" })).getByText("2,500,000원")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다음" })); expect(screen.getAllByRole("article")).toHaveLength(5);
  });
});


it("shows the native cross-PC fixture totals after initial adoption and a screen restart", async () => {
  const income = [...fixture.schoolIncome]; income[1] = fixture.homeUpdate; income.push(fixture.homeCreate);
  const restored = { ...snapshot(income as IncomeRecord[], 6), identity: { ...snapshot([], 6).identity, datasetId: "synthetic-source-dataset" } };
  api.cancelFinanceBackup.mockResolvedValue(undefined); api.selectFinanceBackup.mockResolvedValue("synthetic-ticket");
  api.inspectFinanceBackup.mockResolvedValue({ token: "synthetic-ticket", eligible: true, reason: "사용 이력이 없는 빈 저장소입니다.", requiresDatasetConfirmation: true, currentDatasetId: snapshot().identity.datasetId, backupDatasetId: restored.identity.datasetId, currentRevision: 1, backupRevision: 6, recordCount: 4 });
  api.restoreFinanceBackup.mockResolvedValue(restored);
  await ready(); fireEvent.click(screen.getByRole("button", { name: "백업·복원" }));
  fireEvent.click(screen.getByRole("button", { name: "백업 복원" })); fireEvent.click(screen.getByRole("button", { name: "백업 파일 선택" }));
  await screen.findByLabelText("복원 비밀번호"); change("복원 비밀번호", "synthetic-password-123");
  fireEvent.click(screen.getByRole("button", { name: "복호화 및 유효성 검사" }));
  await screen.findByRole("checkbox"); fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "복원 최종 확인" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "데이터셋 변경 후 이식" }));
  await screen.findByText("암호화 백업을 복원했습니다."); change("연도", "2026");
  expect(screen.getByText("1,350,000원")).toBeTruthy(); expect(screen.getByText("40,500원")).toBeTruthy(); expect(screen.getByText("1,309,500원")).toBeTruthy();
  expect(screen.getAllByRole("article", { name: "수입 항목" })).toHaveLength(3);
  expect(api.restoreFinanceBackup).toHaveBeenCalledExactlyOnceWith("synthetic-ticket", true);
  cleanup(); await ready(restored); change("연도", "2026");
  expect(screen.getByText("1,350,000원")).toBeTruthy(); expect(screen.getByText("40,500원")).toBeTruthy(); expect(screen.getByText("1,309,500원")).toBeTruthy();
  expect(screen.getAllByRole("article", { name: "수입 항목" })).toHaveLength(3);
  cleanup();
});
