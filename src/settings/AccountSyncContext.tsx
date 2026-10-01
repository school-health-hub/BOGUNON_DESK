import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { accountSyncService } from "./accountSyncService";
import type { AccountSyncState } from "./types";

const AccountSyncContext = createContext<AccountSyncState | null>(null);

export function AccountSyncProvider({ children }: { readonly children: ReactNode }) {
  const { state: authState } = useAuth();
  const [syncState, setSyncState] = useState<AccountSyncState>(accountSyncService.getState);

  useEffect(() => accountSyncService.subscribe(setSyncState), []);

  useEffect(() => {
    if (authState.status === "signedIn" && authState.user !== null) {
      accountSyncService.start(authState.user.id);
      return;
    }
    accountSyncService.stop();
  }, [authState.status, authState.user]);

  const value = useMemo(() => syncState, [syncState]);
  return <AccountSyncContext.Provider value={value}>{children}</AccountSyncContext.Provider>;
}

export const useAccountSync = (): AccountSyncState => {
  const value = useContext(AccountSyncContext);
  if (value === null) throw new Error("AccountSyncProvider가 필요합니다.");
  return value;
};
