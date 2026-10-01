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
