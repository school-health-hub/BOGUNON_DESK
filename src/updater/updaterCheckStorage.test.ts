import { beforeEach, describe, expect, it } from "vitest";
import { createUpdaterCheckStorage } from "./updaterCheckStorage";

const values = new Map<string, string>();
const storage: Storage = {
  get length() { return values.size; },
  clear: () => values.clear(),
  getItem: (key) => values.get(key) ?? null,
  key: (index) => [...values.keys()][index] ?? null,
  removeItem: (key) => { values.delete(key); },
  setItem: (key, value) => { values.set(key, value); },
};

beforeEach(() => values.clear());

describe("updater check device storage", () => {
  it("stores only the device-local last check timestamp", () => {
    const repository = createUpdaterCheckStorage(storage);

    repository.saveLastCheckedAt(1_796_000_000_000);

    expect(repository.loadLastCheckedAt()).toBe(1_796_000_000_000);
    expect([...values.values()]).toEqual([JSON.stringify({ lastUpdateCheckAt: 1_796_000_000_000 })]);
  });

  it("treats malformed or invalid timestamps as never checked", () => {
    values.set("school-health-desk.updater.v1", "not-json");
    const repository = createUpdaterCheckStorage(storage);

    expect(repository.loadLastCheckedAt()).toBeNull();

    values.set("school-health-desk.updater.v1", JSON.stringify({ lastUpdateCheckAt: -1 }));
    expect(repository.loadLastCheckedAt()).toBeNull();
  });
});
