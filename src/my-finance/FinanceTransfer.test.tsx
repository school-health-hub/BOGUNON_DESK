// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FinanceTransfer } from "./FinanceTransfer";
import type { FinanceSnapshot } from "./repository";
const api = vi.hoisted(() => ({ cancelFinanceBackup: vi.fn(), exportFinanceBackup: vi.fn(), inspectFinanceBackup: vi.fn(), restoreFinanceBackup: vi.fn(), selectFinanceBackup: vi.fn() }));
vi.mock("./repository", () => api);
const snapshot: FinanceSnapshot = { identity: { schemaVersion: 2, datasetId: "synthetic-dataset", revision: 2, history: ["synthetic-1", "synthetic-2"] }, income: [] };
const preview = { token: "synthetic-ticket", eligible: true, reason: "같은 데이터셋의 후속 백업입니다.", requiresDatasetConfirmation: false, currentDatasetId: "synthetic-local", backupDatasetId: "synthetic-source", currentRevision: 2, backupRevision: 3, recordCount: 1 };
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const setup = () => { const callbacks = { onClose: vi.fn(), onRestored: vi.fn(), onUncertain: vi.fn() }; render(<FinanceTransfer snapshot={snapshot} {...callbacks} />); return callbacks; };
async function selected() { fireEvent.click(screen.getByRole("button", { name: "백업 복원" })); fireEvent.click(screen.getByRole("button", { name: "백업 파일 선택" })); await screen.findByLabelText("복원 비밀번호"); }
async function inspected() { await selected(); change("복원 비밀번호", "synthetic-password-123"); fireEvent.click(screen.getByRole("button", { name: "복호화 및 유효성 검사" })); await screen.findByRole("region", { name: "복원 검사 결과" }); }
beforeEach(() => { vi.resetAllMocks(); api.cancelFinanceBackup.mockResolvedValue(undefined); api.selectFinanceBackup.mockResolvedValue("synthetic-ticket"); api.inspectFinanceBackup.mockResolvedValue(preview); api.restoreFinanceBackup.mockResolvedValue(snapshot); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("exports only after matching passwords, clears secrets, and never uses browser stores/network", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch"); const storeSpy = vi.spyOn(Storage.prototype, "setItem");
  setup(); change("백업 비밀번호", "short"); change("비밀번호 확인", "short"); fireEvent.click(screen.getByRole("button", { name: "암호화 파일 저장" }));
  expect(api.exportFinanceBackup).not.toHaveBeenCalled(); expect(screen.getByRole("alert").textContent).toContain("12~1024");
  api.exportFinanceBackup.mockResolvedValue(true); change("백업 비밀번호", "synthetic-password-123"); change("비밀번호 확인", "synthetic-password-123");
  fireEvent.click(screen.getByRole("button", { name: "암호화 파일 저장" }));
  expect((screen.getByLabelText("백업 비밀번호") as HTMLInputElement).value).toBe("");
  await screen.findByText(/암호화 백업 파일을 저장했습니다/);
  expect(api.exportFinanceBackup).toHaveBeenCalledExactlyOnceWith(snapshot.identity, "synthetic-password-123");
  expect(fetchSpy).not.toHaveBeenCalled(); expect(storeSpy).not.toHaveBeenCalled();
});
it("requires selection, password inspection and a separate final confirmation", async () => {
  const callbacks = setup(); await inspected();
  expect(api.inspectFinanceBackup).toHaveBeenCalledExactlyOnceWith("synthetic-ticket", "synthetic-password-123");
  expect(screen.queryByLabelText("복원 비밀번호")).toBeNull(); expect(api.restoreFinanceBackup).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "복원 최종 확인" }));
  const confirm = within(screen.getByRole("alertdialog")); fireEvent.click(confirm.getByRole("button", { name: "취소" }));
  expect(api.restoreFinanceBackup).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "복원 최종 확인" }));
  const button = within(screen.getByRole("alertdialog")).getByRole("button", { name: "안전 스냅샷 후 복원" }); fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(callbacks.onRestored).toHaveBeenCalledExactlyOnceWith(snapshot));
  expect(api.restoreFinanceBackup).toHaveBeenCalledExactlyOnceWith("synthetic-ticket", false); expect(callbacks.onClose).toHaveBeenCalledOnce();
});
it.each(["다른 데이터셋", "오래된 백업", "변경 이력 충돌", "지원하지 않는 버전"])("blocks an ineligible preview: %s", async (reason) => {
  api.inspectFinanceBackup.mockResolvedValue({ ...preview, eligible: false, reason }); setup(); await inspected();
  expect(screen.getByRole("button", { name: "복원 최종 확인" }).hasAttribute("disabled")).toBe(true); expect(api.restoreFinanceBackup).not.toHaveBeenCalled();
});
it("sanitizes wrong-password/native errors and clears the password", async () => {
  api.inspectFinanceBackup.mockRejectedValue(new Error("SECRET synthetic password and account")); setup(); await selected();
  change("복원 비밀번호", "synthetic-password-123"); fireEvent.click(screen.getByRole("button", { name: "복호화 및 유효성 검사" }));
  await screen.findByRole("alert"); expect(document.body.textContent).not.toContain("SECRET"); expect((screen.getByLabelText("복원 비밀번호") as HTMLInputElement).value).toBe(""); expect(api.restoreFinanceBackup).not.toHaveBeenCalled();
});
it("requires refreshing after a failed or conflicted final restore without retry", async () => {
  api.restoreFinanceBackup.mockRejectedValue("SECRET synthetic native error"); const callbacks = setup(); await inspected();
  fireEvent.click(screen.getByRole("button", { name: "복원 최종 확인" })); fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "안전 스냅샷 후 복원" }));
  await waitFor(() => expect(callbacks.onUncertain).toHaveBeenCalledOnce());
  expect(callbacks.onRestored).not.toHaveBeenCalled(); expect(screen.queryByRole("region", { name: "복원 검사 결과" })).toBeNull(); expect(document.body.textContent).not.toContain("SECRET");
  expect(api.restoreFinanceBackup).toHaveBeenCalledOnce();
});
it("cancels the exact selected native ticket on close/unmount and retains no password", async () => {
  setup(); await selected(); change("복원 비밀번호", "synthetic-password-123"); cleanup();
  expect(api.cancelFinanceBackup).toHaveBeenCalledWith("synthetic-ticket"); expect(api.inspectFinanceBackup).not.toHaveBeenCalled();
});

it("requires explicit dataset consent and a distinct initial-adoption confirmation", async () => {
  api.inspectFinanceBackup.mockResolvedValue({ ...preview, requiresDatasetConfirmation: true, reason: "사용 이력이 없는 빈 저장소입니다." });
  const callbacks = setup(); await inspected();
  const confirm = screen.getByRole("button", { name: "복원 최종 확인" });
  expect(confirm.hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("synthetic-local")).toBeTruthy(); expect(screen.getByText("synthetic-source")).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: "빈 저장소의 데이터셋 변경에 동의합니다" }));
  fireEvent.click(confirm);
  expect(screen.getByRole("alertdialog").textContent).toContain("새 PC로 최초 이식할까요?");
  expect(screen.getByRole("alertdialog").textContent).toContain("synthetic-local");
  expect(screen.getByRole("alertdialog").textContent).toContain("synthetic-source");
  expect(api.restoreFinanceBackup).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "취소" }));
  expect(api.restoreFinanceBackup).not.toHaveBeenCalled();
  fireEvent.click(confirm);
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "데이터셋 변경 후 이식" }));
  await waitFor(() => expect(callbacks.onRestored).toHaveBeenCalledWith(snapshot));
  expect(api.restoreFinanceBackup).toHaveBeenCalledExactlyOnceWith("synthetic-ticket", true);
});
it("resets dataset consent when another backup is selected", async () => {
  api.inspectFinanceBackup.mockResolvedValue({ ...preview, requiresDatasetConfirmation: true });
  setup(); await inspected(); fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "다른 백업 파일 선택" }));
  await screen.findByLabelText("복원 비밀번호"); change("복원 비밀번호", "synthetic-password-123");
  fireEvent.click(screen.getByRole("button", { name: "복호화 및 유효성 검사" }));
  await screen.findByRole("region", { name: "복원 검사 결과" });
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  expect(screen.getByRole("button", { name: "복원 최종 확인" }).hasAttribute("disabled")).toBe(true);
});
