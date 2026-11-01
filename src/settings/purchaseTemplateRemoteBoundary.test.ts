import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultAccountSettings } from "./accountSettings";
import { PurchaseImportTemplateStorageError } from "../purchase/purchaseImportSettings";

const mocks = vi.hoisted(() => ({ maybeSingle: vi.fn(), upsert: vi.fn() }));
vi.mock("../auth/supabaseClient", () => ({
  getSupabaseClient: () => ({ from: () => ({
    select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
    upsert: mocks.upsert,
  }) }),
}));

import { remoteAccountSettingsRepository } from "./remoteAccountSettings";

describe("purchase template remote preservation boundary", () => {
  beforeEach(() => vi.resetAllMocks());

  it("raises the preservation error from the actual remote load before invalid records become empty settings", async () => {
    const settings = { ...createDefaultAccountSettings(), purchaseImportTemplates: [{ id: "old", name: "old", headerSignature: ["품명"], mapping: { name: "0" } }] };
    mocks.maybeSingle.mockResolvedValue({ data: { settings_version: 1, settings }, error: null });

    await expect(remoteAccountSettingsRepository.load("synthetic-user", new AbortController().signal)).rejects.toBeInstanceOf(PurchaseImportTemplateStorageError);

    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("does not send unknown template properties to the remote upsert", async () => {
    const settings = { ...createDefaultAccountSettings(), purchaseImportTemplates: [{ id: "old", name: "old", headerSignature: ["품명"], mapping: { name: 0 }, sampleRows: [["합성 데이터"]] }] };

    await expect(remoteAccountSettingsRepository.save("synthetic-user", settings, new AbortController().signal)).rejects.toBeInstanceOf(PurchaseImportTemplateStorageError);

    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
