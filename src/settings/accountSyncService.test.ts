import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultDashboardLayout } from "../dashboard/layouts";
import { createDefaultDockLayout } from "../dock/storage";
import { createAccountSyncService } from "./accountSyncService";
import type { AccountSettingsScopeRepository } from "./accountSettingsScope";
import type { RemoteAccountSettingsLoadResult, RemoteAccountSettingsRepository } from "./remoteAccountSettings";
import type { AccountSettings } from "./types";
import { defaultWorkspaceFilters } from "./workspaceFilters";
import { defaultPurchaseOutputColumns } from "../purchase/types";

const createSettings = (url: string | null = null): AccountSettings => ({
  workspace: createDefaultDashboardLayout(),
  dock: createDefaultDockLayout(),
  launcherLinks: {
    onlineHealthRoomUrl: url,
    bogunonUrl: null,
    checkupToolUrl: null,
  },
  workspaceFilters: defaultWorkspaceFilters,
  purchaseOutputColumns: defaultPurchaseOutputColumns,
  purchaseImportTemplates: [],
  purchaseDraftTemplates: [],
});

const settle = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const createHarness = (result: RemoteAccountSettingsLoadResult) => {
  let localSettings = createSettings("https://local.example.com/");
  const replace = vi.fn(async (settings: AccountSettings) => {
    localSettings = settings;
  });
  const load = vi.fn(async () => localSettings);
  const remoteLoad = vi.fn(async (_userId: string, _signal: AbortSignal) => result);
  const remoteSave = vi.fn(async (
    _userId: string,
    _settings: AccountSettings,
    _signal: AbortSignal,
  ) => undefined);
  const remote = {
    load: remoteLoad,
    save: remoteSave,
  } satisfies RemoteAccountSettingsRepository;
  const scopedSettings = new Map<string, AccountSettings>();
  let legacyOwnerUserId: string | null = null;
  let lastActiveUserId: string | null = null;
  const scopes = {
    load: (userId: string) => scopedSettings.get(userId) ?? null,
    activate: (userId: string, settings: AccountSettings) => {
      if (lastActiveUserId !== null) scopedSettings.set(lastActiveUserId, settings);
      const sameUser = lastActiveUserId === userId;
      const selected = sameUser
        ? settings
        : scopedSettings.get(userId) ?? (legacyOwnerUserId === null ? settings : null);
      legacyOwnerUserId ??= userId;
      lastActiveUserId = userId;
      if (selected !== null) scopedSettings.set(userId, selected);
      return selected;
    },
    save: (userId: string, settings: AccountSettings) => {
      legacyOwnerUserId ??= userId;
      scopedSettings.set(userId, settings);
    },
  } satisfies AccountSettingsScopeRepository;
  const service = createAccountSyncService({
    local: { load, replace },
    scopes,
    createDefaults: createSettings,
    remote,
    now: () => 1_000,
    schedule: (callback, delay) => setTimeout(callback, delay),
    cancel: (timer) => clearTimeout(timer),
  });
  return {
    getLocal: () => localSettings,
    setLocal: (settings: AccountSettings) => {
      localSettings = settings;
    },
    load,
    replace,
    remoteLoad,
    remoteSave,
    scopes,
    service,
  };
};

describe("AccountSettings sync lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("uploads existing local settings when the remote row is missing", async () => {
    const harness = createHarness({ kind: "missing" });

    harness.service.start("user-a");
    await settle();

    expect(harness.remoteSave).toHaveBeenCalledOnce();
    expect(harness.remoteSave.mock.calls[0]?.[1]).toEqual(harness.getLocal());
    expect(harness.service.getState()).toEqual({ status: "synced", lastSyncedAt: 1_000 });
  });

  it("applies valid remote settings to local cache and subscribers", async () => {
    const remoteSettings = createSettings("https://remote.example.com/");
    const harness = createHarness({ kind: "found", settings: remoteSettings });
    const applied = vi.fn();
    harness.service.subscribeApplied(applied);

    harness.service.start("user-a");
    await settle();

    expect(harness.replace).toHaveBeenCalledWith(remoteSettings);
    expect(harness.getLocal()).toEqual(remoteSettings);
    expect(applied).toHaveBeenCalledWith(remoteSettings);
    expect(harness.remoteSave).not.toHaveBeenCalled();
  });

  it("keeps a local change made while remote settings are being applied", async () => {
    const remoteSettings = createSettings("https://remote.example.com/");
    const localChange = createSettings("https://local-change.example.com/");
    const harness = createHarness({ kind: "found", settings: remoteSettings });
    let releaseReplace = (): void => {
      throw new Error("replace operation did not start");
    };
    const replaceBarrier = new Promise<void>((resolve) => {
      releaseReplace = resolve;
    });
    harness.replace.mockImplementationOnce(async (settings) => {
      harness.setLocal(settings);
      await replaceBarrier;
    });

    harness.service.start("user-a");
    await settle();
    harness.setLocal(localChange);
    harness.service.noteLocalChange();
    releaseReplace();
    await settle();

    expect(harness.getLocal()).toEqual(localChange);
    expect(harness.remoteSave).toHaveBeenCalledWith(
      "user-a",
      localChange,
      expect.any(AbortSignal),
    );
  });

  it("preserves local settings when remote JSON is invalid and syncs a later local change", async () => {
    const harness = createHarness({ kind: "invalid" });
    const before = harness.getLocal();

    harness.service.start("user-a");
    await settle();

    expect(harness.replace).not.toHaveBeenCalled();
    expect(harness.getLocal()).toEqual(before);
    expect(harness.service.getState().status).toBe("error");

    const corrected = createSettings("https://corrected.example.com/");
    harness.setLocal(corrected);
    harness.service.noteLocalChange();
    await vi.advanceTimersByTimeAsync(750);
    await settle();

    expect(harness.remoteSave).toHaveBeenCalledWith(
      "user-a",
      corrected,
      expect.any(AbortSignal),
    );
    expect(harness.service.getState()).toEqual({ status: "synced", lastSyncedAt: 1_000 });
  });

  it("keeps local UI data usable when the network read fails", async () => {
    const harness = createHarness({ kind: "missing" });
    const before = harness.getLocal();
    harness.remoteLoad.mockRejectedValueOnce(new Error("network unavailable"));

    harness.service.start("user-a");
    await settle();

    expect(harness.getLocal()).toEqual(before);
    expect(harness.replace).not.toHaveBeenCalled();
    expect(harness.service.getState().status).toBe("error");
  });

  it.each(["invalid", "network"] as const)(
    "flushes a local change made while an %s remote read is pending",
    async (failure) => {
      const harness = createHarness({ kind: "invalid" });
      let releaseRead = (): void => {
        throw new Error("remote read did not start");
      };
      const readBarrier = new Promise<void>((resolve) => {
        releaseRead = resolve;
      });
      harness.remoteLoad.mockImplementationOnce(async () => {
        await readBarrier;
        if (failure === "network") throw new Error("network unavailable");
        return { kind: "invalid" };
      });
      const changed = createSettings("https://changed-during-read.example.com/");

      harness.service.start("user-a");
      await settle();
      harness.setLocal(changed);
      harness.service.noteLocalChange();
      releaseRead();
      await settle();
      await vi.advanceTimersByTimeAsync(750);
      await settle();

      expect(harness.remoteSave).toHaveBeenCalledWith(
        "user-a",
        changed,
        expect.any(AbortSignal),
      );
      expect(harness.service.getState()).toEqual({ status: "synced", lastSyncedAt: 1_000 });
    },
  );

  it("performs no remote access while signed out", async () => {
    const harness = createHarness({ kind: "missing" });

    harness.service.noteLocalChange();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.remoteLoad).not.toHaveBeenCalled();
    expect(harness.remoteSave).not.toHaveBeenCalled();
  });

  it("debounces workspace, dock, and launcher changes into one latest remote snapshot", async () => {
    const initial = createSettings("https://initial.example.com/");
    const harness = createHarness({ kind: "found", settings: initial });
    harness.service.start("user-a");
    await settle();

    const workspaceChanged: AccountSettings = {
      ...initial,
      workspace: { ...initial.workspace, appearance: { ...initial.workspace.appearance, background: "lavender" } },
    };
    harness.setLocal(workspaceChanged);
    harness.service.noteLocalChange();
    await vi.advanceTimersByTimeAsync(300);

    const dockChanged: AccountSettings = {
      ...workspaceChanged,
      dock: { ...workspaceChanged.dock, items: workspaceChanged.dock.items.map((item, index) => ({ ...item, visible: index !== 0 })) },
    };
    harness.setLocal(dockChanged);
    harness.service.noteLocalChange();
    await vi.advanceTimersByTimeAsync(300);

    const latest = createSettings("https://latest.example.com/");
    harness.setLocal({ ...latest, workspace: dockChanged.workspace, dock: dockChanged.dock });
    harness.service.noteLocalChange();
    expect(harness.remoteSave).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(750);
    await settle();

    expect(harness.remoteSave).toHaveBeenCalledOnce();
    expect(harness.remoteSave.mock.calls[0]?.[1]).toEqual(harness.getLocal());
  });

  it("cancels queued writes on logout without clearing local or deleting remote", async () => {
    const remoteSettings = createSettings("https://remote.example.com/");
    const harness = createHarness({ kind: "found", settings: remoteSettings });
    harness.service.start("user-a");
    await settle();
    const beforeLogout = harness.getLocal();
    harness.service.noteLocalChange();

    harness.service.stop();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.remoteSave).not.toHaveBeenCalled();
    expect(harness.getLocal()).toEqual(beforeLogout);
    expect(harness.service.getState()).toEqual({ status: "signedOut", lastSyncedAt: null });
  });

  it("does not seed a new user from the previous user's local settings and restores user A", async () => {
    const harness = createHarness({ kind: "missing" });
    const userA = harness.getLocal();

    harness.service.start("user-a");
    await settle();
    harness.service.stop();

    harness.remoteLoad.mockImplementation(async (userId) => (
      userId === "user-a"
        ? { kind: "found", settings: userA }
        : { kind: "missing" }
    ));
    harness.remoteSave.mockClear();
    harness.service.start("user-b");
    await settle();

    expect(harness.getLocal()).toEqual(createSettings());
    expect(harness.remoteSave).toHaveBeenCalledWith(
      "user-b",
      createSettings(),
      expect.any(AbortSignal),
    );

    harness.service.stop();
    harness.service.start("user-a");
    await settle();
    expect(harness.getLocal()).toEqual(userA);
  });

  it("applies user B remote settings without exposing user A local settings", async () => {
    const harness = createHarness({ kind: "missing" });
    const userB = createSettings("https://user-b.example.com/");

    harness.service.start("user-a");
    await settle();
    harness.service.stop();
    harness.remoteLoad.mockResolvedValue({ kind: "found", settings: userB });
    harness.remoteSave.mockClear();

    harness.service.start("user-b");
    await settle();

    expect(harness.getLocal()).toEqual(userB);
    expect(harness.remoteSave).not.toHaveBeenCalled();
  });
});
