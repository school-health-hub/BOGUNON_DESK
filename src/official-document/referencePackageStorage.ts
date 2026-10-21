import { invoke, isTauri } from "@tauri-apps/api/core";

export interface ReferencePackageStorage {
  read(): Promise<string | null>;
  write(payload: string): Promise<void>;
  remove(): Promise<void>;
}

type InvokeCommand = (command: string, args?: Readonly<Record<string, unknown>>) => Promise<unknown>;

export class ReferencePackageStorageError extends Error {
  constructor() {
    super("참고자료 로컬 저장소를 처리하지 못했습니다. 기존 자료를 유지합니다.");
    this.name = "ReferencePackageStorageError";
  }
}

export const createNativeReferencePackageStorage = (
  invokeCommand: InvokeCommand = invoke,
  available: () => boolean = isTauri,
): ReferencePackageStorage => {
  const command = async (name: string, args?: Readonly<Record<string, unknown>>): Promise<unknown> => {
    if (!available()) throw new ReferencePackageStorageError();
    try {
      return await invokeCommand(name, args);
    } catch (error: unknown) {
      if (typeof error === "string" || error instanceof Error) throw new ReferencePackageStorageError();
      throw error;
    }
  };
  return {
    read: async () => {
      if (!available()) return null;
      const result = await command("read_official_reference_package");
      if (result === null || typeof result === "string") return result;
      throw new ReferencePackageStorageError();
    },
    write: async (payload) => { await command("write_official_reference_package", { payload }); },
    remove: async () => { await command("remove_official_reference_package"); },
  };
};
