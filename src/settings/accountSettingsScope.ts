import type { AccountSettings } from "./types";
import { parseRemoteAccountSettings, serializeAccountSettings } from "./remoteAccountSettings";

const STORAGE_KEY = "school-health-desk.account-settings-by-user.v1";

export type KeyValueStorage = {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
};

type StoredAccountScopes = {
  readonly legacyOwnerUserId: string | null;
  readonly lastActiveUserId: string | null;
  readonly users: Readonly<Record<string, AccountSettings>>;
};

const emptyScopes = (): StoredAccountScopes => ({
  legacyOwnerUserId: null,
  lastActiveUserId: null,
  users: {},
});
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const parseScopes = (raw: string | null): StoredAccountScopes => {
  if (raw === null) return emptyScopes();
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return emptyScopes();
    const legacyOwnerUserId = typeof value.legacyOwnerUserId === "string"
      ? value.legacyOwnerUserId
      : null;
    const lastActiveUserId = typeof value.lastActiveUserId === "string"
      ? value.lastActiveUserId
      : null;
    const usersValue = value.users;
    if (!isRecord(usersValue)) {
      return { legacyOwnerUserId, lastActiveUserId, users: {} };
    }
    const users: Record<string, AccountSettings> = {};
    for (const [userId, settingsValue] of Object.entries(usersValue)) {
      const settings = parseRemoteAccountSettings(1, settingsValue);
      if (settings !== null) users[userId] = settings;
    }
    return { legacyOwnerUserId, lastActiveUserId, users };
  } catch (error) {
    if (error instanceof SyntaxError) return emptyScopes();
    throw error;
  }
};

export const createAccountSettingsScopeRepository = (storage: KeyValueStorage) => {
  const read = (): StoredAccountScopes => parseScopes(storage.getItem(STORAGE_KEY));
  const write = (scopes: StoredAccountScopes): void => {
    const users = Object.fromEntries(Object.entries(scopes.users).map(([userId, settings]) => [
      userId,
      serializeAccountSettings(settings),
    ]));
    storage.setItem(STORAGE_KEY, JSON.stringify({
      legacyOwnerUserId: scopes.legacyOwnerUserId,
      lastActiveUserId: scopes.lastActiveUserId,
      users,
    }));
  };
  const save = (userId: string, settings: AccountSettings): void => {
    const scopes = read();
    write({
      legacyOwnerUserId: scopes.legacyOwnerUserId ?? userId,
      lastActiveUserId: scopes.lastActiveUserId,
      users: { ...scopes.users, [userId]: settings },
    });
  };
  return {
    load: (userId: string): AccountSettings | null => read().users[userId] ?? null,
    activate: (userId: string, currentSettings: AccountSettings): AccountSettings | null => {
      const scopes = read();
      const users = { ...scopes.users };
      if (scopes.lastActiveUserId !== null) {
        users[scopes.lastActiveUserId] = currentSettings;
      }
      const sameUser = scopes.lastActiveUserId === userId;
      const canClaimLegacy = scopes.legacyOwnerUserId === null;
      const settings = sameUser ? currentSettings : users[userId] ?? (canClaimLegacy ? currentSettings : null);
      if (settings !== null) users[userId] = settings;
      write({
        legacyOwnerUserId: scopes.legacyOwnerUserId ?? userId,
        lastActiveUserId: userId,
        users,
      });
      return settings;
    },
    save,
  } as const;
};

export type AccountSettingsScopeRepository = ReturnType<typeof createAccountSettingsScopeRepository>;

export const accountSettingsScopeRepository: AccountSettingsScopeRepository = {
  load: (userId) => createAccountSettingsScopeRepository(window.localStorage).load(userId),
  activate: (userId, settings) => (
    createAccountSettingsScopeRepository(window.localStorage).activate(userId, settings)
  ),
  save: (userId, settings) => createAccountSettingsScopeRepository(window.localStorage).save(userId, settings),
};
