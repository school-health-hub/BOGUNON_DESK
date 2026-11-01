import type { PurchaseAnalysisResult, PurchaseMappingCandidate, PurchaseSourceSummary } from "./types";

export type PurchaseImportRequestContext = {
  readonly origin?: "picker" | "mapping" | "native" | "direct";
  readonly candidateId?: string;
  readonly headerRow?: number;
  readonly mappingRevision?: number;
};
export type PurchaseImportRequestToken = PurchaseImportRequestContext & {
  readonly session: number;
  readonly requestId: number;
  readonly origin: "picker" | "mapping" | "native" | "direct";
};
export type PurchaseImportSession = {
  readonly begin: (context?: PurchaseImportRequestContext) => PurchaseImportRequestToken;
  readonly isCurrent: (token: PurchaseImportRequestToken) => boolean;
  readonly accept: (token: PurchaseImportRequestToken) => boolean;
  readonly invalidate: () => void;
  readonly advanceNativeFloor: (generation: number) => void;
  readonly beginNative: (generation: number) => PurchaseImportRequestToken | null;
};

export const createPurchaseImportSession = (): PurchaseImportSession => {
  let epoch = 0;
  let sequence = 0;
  let current: PurchaseImportRequestToken | null = null;
  let accepted = false;
  let nativeFloor = -1;
  const isCurrent = (token: PurchaseImportRequestToken) => current === token && token.session === epoch;
  const begin = (context: PurchaseImportRequestContext = {}): PurchaseImportRequestToken => {
    current = Object.freeze({ ...context, origin: context.origin ?? "direct", session: epoch, requestId: ++sequence });
    accepted = false;
    return current;
  };
  return {
    begin,
    isCurrent,
    accept: (token) => {
      if (!isCurrent(token) || accepted) return false;
      accepted = true;
      return true;
    },
    invalidate: () => { epoch++; current = null; accepted = false; },
    advanceNativeFloor: (generation) => { if (Number.isSafeInteger(generation)) nativeFloor = Math.max(nativeFloor, generation); },
    beginNative: (generation) => {
      if (!Number.isSafeInteger(generation) || generation <= nativeFloor) return null;
      if (current !== null && !accepted) {
        switch (current.origin) {
          case "direct": case "mapping": nativeFloor = generation; return null;
          case "picker": nativeFloor = generation; return current;
          case "native": break;
        }
      }
      nativeFloor = generation;
      return begin({ origin: "native" });
    },
  };
};

type RequestOptions<T> = {
  readonly session: PurchaseImportSession;
  readonly context?: PurchaseImportRequestContext;
  readonly isValid?: () => boolean;
  readonly analyze: (token: PurchaseImportRequestToken) => Promise<T>;
  readonly apply: (result: T) => void;
  readonly onAccepted?: () => void | Promise<void>;
  readonly onError: (error: unknown) => void;
};

export const runPurchaseImportRequest = async <T>(options: RequestOptions<T>): Promise<void> => {
  const token = options.session.begin(options.context);
  try {
    const result = await options.analyze(token);
    if (options.isValid?.() === false || !options.session.accept(token)) return;
    options.apply(result);
    if (options.session.isCurrent(token)) await options.onAccepted?.();
  } catch (error: unknown) {
    if (options.session.isCurrent(token) && options.isValid?.() !== false) {
      options.session.accept(token);
      options.onError(error);
    }
  }
};

export const invalidatePurchaseImportContext = (session: PurchaseImportSession, apply: () => void): void => {
  session.invalidate();
  apply();
};

export const mergePurchaseImportSources = (
  current: readonly PurchaseSourceSummary[],
  incoming: readonly PurchaseSourceSummary[],
): readonly PurchaseSourceSummary[] => {
  const replacements = new Map(incoming.flatMap((source) => source.candidateId === undefined ? [] : [[source.candidateId, source] as const]));
  const replaced = new Set<string>();
  const next = current.map((source) => {
    const replacement = source.candidateId === undefined ? undefined : replacements.get(source.candidateId);
    if (replacement !== undefined && source.candidateId !== undefined) replaced.add(source.candidateId);
    return replacement ?? source;
  });
  return [...next, ...incoming.filter((source) => source.candidateId === undefined || !replaced.has(source.candidateId))];
};

export const mergePurchaseImportCandidates = (
  current: readonly PurchaseMappingCandidate[],
  result: PurchaseAnalysisResult,
): readonly PurchaseMappingCandidate[] => {
  const completed = new Set(result.sources.flatMap((source) => source.status === "success" && source.candidateId !== undefined ? [source.candidateId] : []));
  const replaced = new Set(result.candidates.map((candidate) => candidate.id));
  return [...current.filter((candidate) => !completed.has(candidate.id) && !replaced.has(candidate.id)), ...result.candidates];
};
