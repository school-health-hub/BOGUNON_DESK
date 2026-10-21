import { validateReferencePackage } from "./referencePackage";
import type { ReferencePackageMetadata, ReferencePackageValidation, ValidatedReferencePackage } from "./referencePackageTypes";
import { createNativeReferencePackageStorage, type ReferencePackageStorage } from "./referencePackageStorage";
import type { OfficialDocumentReferenceRepository } from "./referenceTypes";

export type ReferencePackageMode = "session" | "persistent";
export type ReferencePackageSnapshot = {
  readonly active: ValidatedReferencePackage | null;
  readonly mode: ReferencePackageMode | null;
  readonly saved: boolean;
  readonly savedMetadata: ReferencePackageMetadata | null;
  readonly error: string | null;
};

export class ReferencePackageRestoreError extends Error {
  constructor() {
    super("저장된 참고자료를 검증하지 못했습니다. 저장본을 사용하지 않으며 삭제하지 않았습니다.");
    this.name = "ReferencePackageRestoreError";
  }
}

export interface ReferencePackageService {
  snapshot(): ReferencePackageSnapshot;
  subscribe(listener: () => void): () => void;
  initialize(): Promise<void>;
  prepare(text: string): Promise<ReferencePackageValidation>;
  activate(pkg: ValidatedReferencePackage, mode: ReferencePackageMode): Promise<void>;
  remove(): Promise<void>;
  readonly repository: OfficialDocumentReferenceRepository;
}

type Options = {
  readonly storage?: ReferencePackageStorage;
  readonly validate?: (text: string) => Promise<ReferencePackageValidation>;
};

export const createReferencePackageService = ({
  storage = createNativeReferencePackageStorage(),
  validate = validateReferencePackage,
}: Options = {}): ReferencePackageService => {
  let state: ReferencePackageSnapshot = { active: null, mode: null, saved: false, savedMetadata: null, error: null };
  let initialized: Promise<void> | null = null;
  let pending: Promise<void> = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (next: ReferencePackageSnapshot): void => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const enqueue = (operation: () => Promise<void>): Promise<void> => {
    const result = pending.then(operation);
    pending = result.then(() => undefined, () => undefined);
    return result;
  };
  return {
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    initialize: () => {
      initialized ??= enqueue(async () => {
        let text: string | null;
        try { text = await storage.read(); }
        catch {
          publish({ ...state, saved: true, error: new ReferencePackageRestoreError().message });
          throw new ReferencePackageRestoreError();
        }
        if (text === null) return;
        const result = await validate(text);
        if (result.status === "error" || result.report.excludedRows > 0) {
          publish({ ...state, saved: true, error: new ReferencePackageRestoreError().message });
          throw new ReferencePackageRestoreError();
        }
        publish({ active: state.active ?? result.package, mode: state.mode ?? "persistent", saved: true, savedMetadata: result.package.metadata, error: null });
      });
      return initialized;
    },
    prepare: validate,
    activate: (pkg, mode) => enqueue(async () => {
      const result = await validate(pkg.serialized);
      if (result.status === "error" || result.package.contentHash !== pkg.contentHash) throw new ReferencePackageRestoreError();
      if (mode === "persistent") await storage.write(result.package.serialized);
      if (initialized !== null) initialized = Promise.resolve();
      publish({
        active: result.package,
        mode,
        saved: mode === "persistent" || state.saved,
        savedMetadata: mode === "persistent" ? result.package.metadata : state.savedMetadata,
        error: null,
      });
    }),
    remove: () => enqueue(async () => {
      if (state.saved) await storage.remove();
      initialized = Promise.resolve();
      publish({ active: null, mode: null, saved: false, savedMetadata: null, error: null });
    }),
    repository: {
      list: async () => state.active === null
        ? { status: "notConnected" }
        : state.active.references.length === 0
          ? { status: "empty" }
          : { status: "ready", references: state.active.references },
    },
  };
};

export const defaultReferencePackageService = createReferencePackageService();
