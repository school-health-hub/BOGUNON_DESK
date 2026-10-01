import { createContext, useContext, type ReactNode } from "react";
import type { DesktopActionId } from "../../desktop/types";
import type { WorkFolderFavorite } from "../../work-folders/types";

type DesktopPanelContextValue = {
  readonly notify: (message: string) => void;
  readonly openInbox: () => void;
  readonly openBogunonTask: (taskId: string, date: string | null) => Promise<void>;
  readonly openQuickAddEventForDate: (date: string) => void;
  readonly openQuickAddFromMemo: (title: string) => void;
  readonly openQuickMemoUrl: (url: string) => Promise<void>;
  readonly runDesktopAction: (actionId: DesktopActionId) => Promise<void>;
  readonly workFolderFavorites: readonly WorkFolderFavorite[];
  readonly openWorkFolderFavorite: (favorite: WorkFolderFavorite) => Promise<void>;
};

const DesktopPanelContext = createContext<DesktopPanelContextValue | null>(null);

type DesktopPanelProviderProps = DesktopPanelContextValue & { readonly children: ReactNode };

export function DesktopPanelProvider({ children, notify, openBogunonTask, openInbox, openQuickAddEventForDate, openQuickAddFromMemo, openQuickMemoUrl, runDesktopAction, workFolderFavorites, openWorkFolderFavorite }: DesktopPanelProviderProps) {
  return <DesktopPanelContext.Provider value={{ notify, openBogunonTask, openInbox, openQuickAddEventForDate, openQuickAddFromMemo, openQuickMemoUrl, runDesktopAction, workFolderFavorites, openWorkFolderFavorite }}>{children}</DesktopPanelContext.Provider>;
}

export const useDesktopPanels = (): DesktopPanelContextValue => {
  const value = useContext(DesktopPanelContext);
  if (value === null) throw new Error("DesktopPanelProvider가 필요합니다.");
  return value;
};
