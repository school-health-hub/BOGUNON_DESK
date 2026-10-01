import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SecureSessionStorageError, secureSessionStorage } from "./secureSessionStorage";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);

describe("secureSessionStorage", () => {
  beforeEach(() => invokeMock.mockReset());

  it("routes session values only through Tauri secure storage commands", async () => {
    invokeMock.mockResolvedValueOnce("stored-session");
    await expect(secureSessionStorage.getItem("sb-project-auth-token"))
      .resolves.toBe("stored-session");
    expect(invokeMock).toHaveBeenCalledWith("secure_session_get", {
      key: "sb-project-auth-token",
    });

    invokeMock.mockResolvedValueOnce(undefined);
    await secureSessionStorage.setItem("sb-project-auth-token", "new-session");
    expect(invokeMock).toHaveBeenLastCalledWith("secure_session_set", {
      key: "sb-project-auth-token",
      value: "new-session",
    });
  });

  it("converts native storage failures into a user-safe error", async () => {
    invokeMock.mockRejectedValueOnce("native details");
    await expect(secureSessionStorage.removeItem("sb-project-auth-token"))
      .rejects.toBeInstanceOf(SecureSessionStorageError);
  });
});
