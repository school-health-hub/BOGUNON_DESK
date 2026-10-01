import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "./authService";
import type { AuthState } from "./types";

type AuthContextValue = {
  readonly state: AuthState;
  readonly getCurrentUser: typeof authService.getCurrentUser;
  readonly signInWithGoogle: typeof authService.signInWithGoogle;
  readonly signOut: typeof authService.signOut;
  readonly clearNotice: typeof authService.clearNotice;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<AuthState>(authService.getState);

  useEffect(() => {
    const unsubscribe = authService.subscribe(setState);
    void authService.initialize();
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    state,
    getCurrentUser: authService.getCurrentUser,
    signInWithGoogle: authService.signInWithGoogle,
    signOut: authService.signOut,
    clearNotice: authService.clearNotice,
  }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (value === null) throw new Error("AuthProvider가 필요합니다.");
  return value;
};
