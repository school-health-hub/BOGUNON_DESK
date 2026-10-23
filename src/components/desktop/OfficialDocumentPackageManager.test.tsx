// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReferencePackageService } from "../../official-document/referencePackageService";
import { hashReferencePackageRow } from "../../official-document/referencePackage";
import { OFFICIAL_DOCUMENT_REFERENCE_HEADERS as headers } from "../../official-document/referenceRepository";
import type { ReferencePackageStorage } from "../../official-document/referencePackageStorage";
import { OfficialDocumentPackageManager } from "./OfficialDocumentPackageManager";

const fixture = async (id = "synthetic-package"): Promise<string> => {
  const values: Readonly<Record<string, string>> = { No: "1", 사용여부: "TRUE", 비식별여부: "TRUE", 자료명: "합성 계획 자료", 템플릿본문: "1. 합성 업무 계획" };
  const row = headers.map((header) => values[header] ?? "");
  return JSON.stringify({ schemaVersion: 1, packageId: id, packageVersion: "1.0.0", publishedAt: "2026-10-22", source: "합성 자료", usageTerms: "검증용", redistribution: "재배포 제한", review: { reviewer: "합성 검토자", reviewedAt: "2026-10-22", approvedRows: [{ sourceNo: "1", sha256: await hashReferencePackageRow(headers, row) }] }, headers, rows: [row] });
};

const memory = (initial: string | null = null) => {
  let text = initial;
  const storage: ReferencePackageStorage = {
    read: vi.fn(async () => text),
    write: vi.fn(async (next) => { text = next; }),
    remove: vi.fn(async () => { text = null; }),
  };
  return { service: createReferencePackageService({ storage }), storage };
};

const choose = (text: string): void => {
  const file = new File([], "synthetic.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => text });
  fireEvent.change(screen.getByLabelText("참고자료 JSON 패키지 선택"), { target: { files: [file] } });
};

describe("OfficialDocumentPackageManager", () => {
  afterEach(cleanup);

  it("does not activate a package before the user confirms the preview", async () => {
    render(<OfficialDocumentPackageManager onRepositoryChange={vi.fn()} />);
    expect(screen.getByLabelText("참고자료 JSON 패키지 선택")).toHaveProperty("accept", ".json,application/json");
    expect(screen.queryByRole("button", { name: "확인 후 패키지 반입" })).toBeNull();
    await waitFor(() => expect(screen.queryByText("저장된 참고자료 확인 중…")).toBeNull());
  });

  it("rejects an oversized file before reading it", async () => {
    render(<OfficialDocumentPackageManager onRepositoryChange={vi.fn()} />);
    const text = vi.fn(async () => "{}");
    const file = new File([], "synthetic.json", { type: "application/json" });
    Object.defineProperty(file, "size", { value: 5 * 1024 * 1024 + 1 });
    Object.defineProperty(file, "text", { value: text });
    fireEvent.change(screen.getByLabelText("참고자료 JSON 패키지 선택"), { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "JSON 파일은 최대 5MiB까지 반입할 수 있습니다.");
    expect(text).not.toHaveBeenCalled();
  });

  it("previews a real reviewed package and activates only after explicit confirmation", async () => {
    const { service, storage } = memory();
    const changed = vi.fn();
    render(<OfficialDocumentPackageManager service={service} onRepositoryChange={changed} />);
    await waitFor(() => expect(screen.getByLabelText("참고자료 JSON 패키지 선택")).toHaveProperty("disabled", false));
    choose(await fixture());
    await screen.findByText("반입 후보: synthetic-package · 1.0.0");
    expect(screen.getByText(/사용 가능 1건/)).toBeTruthy();
    expect(service.snapshot().active).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "확인 후 패키지 반입" }));
    await waitFor(() => expect(service.snapshot().active?.metadata.packageId).toBe("synthetic-package"));
    expect(storage.write).not.toHaveBeenCalled();
    await expect(service.repository.list()).resolves.toMatchObject({ status: "ready", references: [{ title: "합성 계획 자료" }] });
  });

  it("preserves the active package when a persistent replacement fails", async () => {
    const { service, storage } = memory(await fixture("previous"));
    render(<OfficialDocumentPackageManager service={service} onRepositoryChange={vi.fn()} />);
    await screen.findByText("previous · 1.0.0");
    choose(await fixture("replacement"));
    await screen.findByText("반입 후보: replacement · 1.0.0");
    fireEvent.change(screen.getByLabelText("패키지 사용 방식"), { target: { value: "persistent" } });
    vi.mocked(storage.write).mockRejectedValue(new Error("synthetic failure"));
    fireEvent.click(screen.getByRole("button", { name: "확인 후 패키지 반입" }));
    await screen.findByText("패키지를 반입하지 못했습니다. 기존 참고자료와 작성 중인 공문은 유지됩니다.");
    expect(service.snapshot().active?.metadata.packageId).toBe("previous");
  });

  it("offers explicit deletion for a corrupt stored package without deleting automatically", async () => {
    const { service, storage } = memory("invalid synthetic package");
    render(<OfficialDocumentPackageManager service={service} onRepositoryChange={vi.fn()} />);
    await screen.findByRole("alert");
    expect(storage.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "참고자료 패키지 삭제" }));
    expect(storage.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "확인 후 참고자료 삭제" }));
    await waitFor(() => expect(storage.remove).toHaveBeenCalledOnce());
    expect(service.snapshot().saved).toBe(false);
  });
});
