export type CommandShortcutEvent = {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
};

export type CommandShortcutHandlerEvent = CommandShortcutEvent & {
  readonly preventDefault: () => void;
};

export type CommandShortcutHandlers = {
  readonly isOpen: boolean;
  readonly onFocus: () => void;
  readonly onOpen: () => void;
};

export type CommandKeyResult =
  | { readonly type: "none" }
  | { readonly type: "close" }
  | { readonly type: "move"; readonly index: number }
  | { readonly type: "execute"; readonly index: number };

export const isCommandPaletteShortcut = (event: CommandShortcutEvent): boolean => (
  event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLocaleLowerCase() === "k"
);

export const handleCommandPaletteShortcut = (
  event: CommandShortcutHandlerEvent,
  handlers: CommandShortcutHandlers,
): boolean => {
  if (!isCommandPaletteShortcut(event)) return false;
  event.preventDefault();
  if (handlers.isOpen) handlers.onFocus();
  else handlers.onOpen();
  return true;
};

export const updateCommandQuery = (query: string) => ({ query, activeIndex: 0 } as const);

export const resolveCommandKey = (
  key: string,
  activeIndex: number,
  resultCount: number,
): CommandKeyResult => {
  if (key === "Escape") return { type: "close" };
  if (resultCount === 0) return { type: "none" };
  if (key === "ArrowDown") return { type: "move", index: (activeIndex + 1) % resultCount };
  if (key === "ArrowUp") return { type: "move", index: (activeIndex - 1 + resultCount) % resultCount };
  if (key === "Enter") return { type: "execute", index: activeIndex };
  return { type: "none" };
};
