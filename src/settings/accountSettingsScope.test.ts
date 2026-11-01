import { describe, expect, it } from "vitest";
import { createDefaultAccountSettings } from "./accountSettings";
import { createAccountSettingsScopeRepository, type KeyValueStorage } from "./accountSettingsScope";

const createStorage = (): KeyValueStorage => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

describe("account settings user scopes", () => {
  it("preserves invalid numeric mappings across save, activation and re-query", () => {
    const repository = createAccountSettingsScopeRepository(createStorage());
    const settings = { ...createDefaultAccountSettings(), purchaseImportTemplates: [{ id: " old ", name: " old ", headerSignature: ["품명", "", "수량", ""], mapping: { name: 0, quantity: 0, amount: -1 } }] };
    repository.save("user-a", settings);
    expect(repository.activate("user-a", settings)).toEqual(settings);
    expect(repository.load("user-a")).toEqual(settings);
  });
  it("refuses to rewrite any scopes when a stored template cannot be represented", () => {
    const invalid = { ...createDefaultAccountSettings(), purchaseImportTemplates: [{ id: "old", name: "old", headerSignature: ["품명"], mapping: { name: "0" } }] };
    const raw = JSON.stringify({ legacyOwnerUserId: "user-a", lastActiveUserId: "user-a", users: { "user-a": invalid } });
    let stored = raw;
    const repository = createAccountSettingsScopeRepository({ getItem: () => stored, setItem: (_key, value) => { stored = value; } });
    expect(() => repository.save("user-b", createDefaultAccountSettings())).toThrow();
    expect(() => repository.activate("user-a", createDefaultAccountSettings())).toThrow();
    expect(stored).toBe(raw);
  });
  it.each(["not json", "null", JSON.stringify({ users: null })])("does not overwrite an unreadable existing scope container: %s", (raw) => {
    let stored = raw;
    const repository = createAccountSettingsScopeRepository({ getItem: () => stored, setItem: (_key, value) => { stored = value; } });
    expect(() => repository.activate("user-a", createDefaultAccountSettings())).toThrow();
    expect(() => repository.save("user-a", createDefaultAccountSettings())).toThrow();
    expect(stored).toBe(raw);
  });
  it("claims legacy settings once and never gives them to another user", () => {
    const repository = createAccountSettingsScopeRepository(createStorage());
    const legacy = {
      ...createDefaultAccountSettings(),
      launcherLinks: {
        onlineHealthRoomUrl: "https://user-a.example/",
        bogunonUrl: null,
        checkupToolUrl: null,
      },
    };

    expect(repository.activate("user-a", legacy)).toEqual(legacy);
    expect(repository.activate("user-b", legacy)).toBeNull();
    expect(repository.load("user-a")).toEqual(legacy);
  });

  it("captures the previous user's latest local settings while switching accounts", () => {
    const repository = createAccountSettingsScopeRepository(createStorage());
    const userA = createDefaultAccountSettings();
    const changedA = {
      ...userA,
      launcherLinks: {
        onlineHealthRoomUrl: "https://latest-user-a.example/",
        bogunonUrl: null,
        checkupToolUrl: null,
      },
    };

    repository.activate("user-a", userA);
    repository.activate("user-b", changedA);

    expect(repository.load("user-a")).toEqual(changedA);
  });

  it("persists complete settings independently for each user", () => {
    const repository = createAccountSettingsScopeRepository(createStorage());
    const userA = createDefaultAccountSettings();
    const userB = {
      ...createDefaultAccountSettings(),
      workspaceFilters: {
        healthWork: false,
        schoolSchedule: true,
        personal: true,
        exercise: false,
        project: false,
      },
      purchaseImportTemplates: [{
        id: "template-b",
        name: "B 양식",
        headerSignature: ["상품"],
        mapping: { name: 0 },
      }],
    };

    repository.save("user-a", userA);
    repository.save("user-b", userB);

    expect(repository.load("user-a")).toEqual(userA);
    expect(repository.load("user-b")).toEqual(userB);
  });
});
