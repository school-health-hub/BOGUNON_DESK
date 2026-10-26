import type { AuthState } from "../auth/types";

const state: AuthState = { status: "signedOut", user: null, notice: null };
export const authService = {
  getState: (): AuthState => state,
  subscribe: (listener: (value: AuthState) => void): (() => void) => { listener(state); return () => undefined; },
};
