const STORAGE_KEY = "bogunon-desk:chatgpt-selected-model";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const loadSelectedChatGptModel = (storage: StorageLike = window.localStorage): string | null => {
  const value = storage.getItem(STORAGE_KEY);
  return value === null || value.trim() === "" ? null : value;
};

export const saveSelectedChatGptModel = (
  model: string | null,
  storage: StorageLike = window.localStorage,
): void => {
  if (model === null || model.trim() === "") {
    storage.removeItem(STORAGE_KEY);
    return;
  }
  storage.setItem(STORAGE_KEY, model);
};
