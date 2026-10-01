import { invoke } from "@tauri-apps/api/core";

export class SecureSessionStorageError extends Error {
  constructor(_cause?: unknown) {
    super("Windows 보안 저장소에 로그인 정보를 저장하지 못했습니다.");
    this.name = "SecureSessionStorageError";
  }
}

const secureInvoke = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw new SecureSessionStorageError(error);
  }
};

export const secureSessionStorage = {
  getItem: (key: string): Promise<string | null> =>
    secureInvoke<string | null>("secure_session_get", { key }),
  setItem: (key: string, value: string): Promise<void> =>
    secureInvoke<void>("secure_session_set", { key, value }),
  removeItem: (key: string): Promise<void> =>
    secureInvoke<void>("secure_session_remove", { key }),
  clear: (): Promise<void> => secureInvoke<void>("secure_session_clear"),
} as const;
