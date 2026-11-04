import type {WorkFolderFavorite} from "./types";

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
