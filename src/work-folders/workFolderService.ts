import { invoke, isTauri } from "@tauri-apps/api/core";
import type { WorkFolderFavorite } from "./types";

const unavailable = (): never => {
  throw new Error("업무 폴더는 Tauri 앱에서 사용할 수 있습니다.");
};

export const filterWorkFolderFavorites = (
  favorites: readonly WorkFolderFavorite[],
  query: string,
): readonly WorkFolderFavorite[] => {
  const normalized = query.trim().toLocaleLowerCase();
  if (normalized === "") return [];
  return favorites.filter((favorite) => {
    const pathParts = favorite.path.split(/[\\/]/);
    const basename = pathParts[pathParts.length - 1] ?? "";
    return favorite.name.toLocaleLowerCase().includes(normalized)
      || basename.toLocaleLowerCase().includes(normalized);
  });
};

export const workFolderService = {
  load: async (): Promise<readonly WorkFolderFavorite[]> => (
    isTauri() ? invoke<WorkFolderFavorite[]>("get_work_folder_favorites") : []
  ),
  pick: async (): Promise<readonly WorkFolderFavorite[] | null> => {
    if (!isTauri()) return unavailable();
    return invoke<WorkFolderFavorite[] | null>("pick_work_folder_favorite");
  },
  rename: async (id: string, name: string): Promise<readonly WorkFolderFavorite[]> => {
    if (!isTauri()) return unavailable();
    return invoke<WorkFolderFavorite[]>("rename_work_folder_favorite", { id, name });
  },
  remove: async (id: string): Promise<readonly WorkFolderFavorite[]> => {
    if (!isTauri()) return unavailable();
    return invoke<WorkFolderFavorite[]>("delete_work_folder_favorite", { id });
  },
  reorder: async (ids: readonly string[]): Promise<readonly WorkFolderFavorite[]> => {
    if (!isTauri()) return unavailable();
    return invoke<WorkFolderFavorite[]>("reorder_work_folder_favorites", { ids });
  },
  open: async (id: string): Promise<void> => {
    if (!isTauri()) return unavailable();
    await invoke("open_work_folder_favorite", { id });
  },
} as const;
