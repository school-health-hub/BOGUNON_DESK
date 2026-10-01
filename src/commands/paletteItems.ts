import type { CommandDefinition } from "./types";
import type { BogunonSearchItem, BogunonSearchState } from "../workspace-search/types";
import type { WorkFolderFavorite } from "../work-folders/types";

export type PaletteSelectableItem =
  | { readonly kind: "command"; readonly command: CommandDefinition }
  | { readonly kind: "folder"; readonly favorite: WorkFolderFavorite }
  | BogunonSearchItem;

export type PaletteItemHandlers = {
  readonly runCommand: (command: CommandDefinition) => Promise<void>;
  readonly runSearchResult: (item: BogunonSearchItem) => Promise<void>;
  readonly runFolder: (favorite: WorkFolderFavorite) => Promise<void>;
};

export const buildPaletteItems = (
  commands: readonly CommandDefinition[],
  folders: readonly WorkFolderFavorite[],
  searchState: BogunonSearchState,
): readonly PaletteSelectableItem[] => [
  ...commands.map((command) => ({ kind: "command", command }) as const),
  ...folders.map((favorite) => ({ kind: "folder", favorite }) as const),
  ...(searchState.status === "ready" ? searchState.items : []),
];

export const clampPaletteActiveIndex = (activeIndex: number, resultCount: number): number => (
  resultCount === 0 ? 0 : Math.min(activeIndex, resultCount - 1)
);

export const executePaletteItem = async (
  item: PaletteSelectableItem,
  handlers: PaletteItemHandlers,
): Promise<void> => {
  if (item.kind === "command") await handlers.runCommand(item.command);
  else if (item.kind === "folder") await handlers.runFolder(item.favorite);
  else await handlers.runSearchResult(item);
};
