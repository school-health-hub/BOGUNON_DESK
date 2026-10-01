export type AuthUser = {
  readonly id: string;
  readonly email: string | null;
  readonly displayName: string | null;
};

export type AuthStatus = "loading" | "signedOut" | "signingIn" | "signedIn" | "signingOut";

export type AuthNotice = {
  readonly id: number;
  readonly message: string;
};

export type AuthState = {
  readonly status: AuthStatus;
  readonly user: AuthUser | null;
  readonly notice: AuthNotice | null;
};

export type AuthStateListener = (state: AuthState) => void;
