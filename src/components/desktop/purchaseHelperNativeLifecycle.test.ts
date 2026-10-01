import { describe, expect, it, vi } from "vitest";
import type {
  PurchaseAnalysisResult,
  PurchaseImportTemplate,
} from "../../purchase/types";
import {
  createPurchaseHelperStateQueue,
  mountPurchaseHelperNativeBridge,
  type PurchaseHelperStateQueue,
} from "./purchaseHelperNativeLifecycle";

const analysisResult: PurchaseAnalysisResult = {
  items: [],
  sources: [],
  candidates: [],
};

const template = (id: string): PurchaseImportTemplate => ({
  id,
  name: id,
  headerSignature: [id],
  mapping: { name: 0 },
});

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: Error) => void;
} {
  let settle: ((value: T) => void) | null = null;
  let fail: ((reason: Error) => void) | null = null;
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return {
    promise,
    resolve(value) {
      if (settle === null) throw new Error("Deferred promise is not initialized.");
      settle(value);
    },
    reject(reason) {
      if (fail === null) throw new Error("Deferred promise is not initialized.");
      fail(reason);
    },
  };
}

const resolvedStateQueue = (): PurchaseHelperStateQueue => ({
  update: vi.fn(async () => undefined),
});

describe("purchase helper native lifecycle", () => {
  it("registers each listener once and dispatches to the latest callbacks", async () => {
    const analysisDisposer = vi.fn();
    const errorDisposer = vi.fn();
    let analysisHandler = (_result: PurchaseAnalysisResult): void => undefined;
    let errorHandler = (_message: string): void => undefined;
    const analysisRegistrar = vi.fn(async (handler: typeof analysisHandler) => {
      analysisHandler = handler;
      return analysisDisposer;
    });
    const errorRegistrar = vi.fn(async (handler: typeof errorHandler) => {
      errorHandler = handler;
      return errorDisposer;
    });
    const firstAnalysis = vi.fn();
    const latestAnalysis = vi.fn();
    const firstNotice = vi.fn();
    const latestNotice = vi.fn();
    let currentAnalysis = firstAnalysis;
    let currentNotice = firstNotice;
    const stateQueue = resolvedStateQueue();
    const initialTemplates = [template("initial")];
    const bridge = mountPurchaseHelperNativeBridge({
      registrars: { analysis: analysisRegistrar, error: errorRegistrar },
      callbacks: { analysis: () => currentAnalysis, notice: () => currentNotice },
      stateQueue,
      initialTemplates,
    });
    await Promise.resolve();

    currentAnalysis = latestAnalysis;
    currentNotice = latestNotice;
    analysisHandler(analysisResult);
    errorHandler("분석 오류");
    bridge.syncTemplates([template("latest")]);

    expect(analysisRegistrar).toHaveBeenCalledTimes(1);
    expect(errorRegistrar).toHaveBeenCalledTimes(1);
    expect(firstAnalysis).not.toHaveBeenCalled();
    expect(firstNotice).not.toHaveBeenCalled();
    expect(latestAnalysis).toHaveBeenCalledWith(analysisResult);
    expect(latestNotice).toHaveBeenCalledWith("분석 오류");
    expect(stateQueue.update).toHaveBeenCalledTimes(2);

    bridge.dispose();
    bridge.syncTemplates([template("ignored-after-dispose")]);
    expect(analysisDisposer).toHaveBeenCalledTimes(1);
    expect(errorDisposer).toHaveBeenCalledTimes(1);
    expect(stateQueue.update).toHaveBeenCalledTimes(3);
    expect(stateQueue.update).toHaveBeenLastCalledWith(false, []);
  });

  it("disposes registrations that resolve after unmount and ignores later events", async () => {
    const analysisRegistration = deferred<() => void>();
    const errorRegistration = deferred<() => void>();
    const analysisDisposer = vi.fn();
    const errorDisposer = vi.fn();
    const onAnalysis = vi.fn();
    const onNotice = vi.fn();
    let analysisHandler = (_result: PurchaseAnalysisResult): void => undefined;
    let errorHandler = (_message: string): void => undefined;
    const bridge = mountPurchaseHelperNativeBridge({
      registrars: {
        analysis: (handler) => {
          analysisHandler = handler;
          return analysisRegistration.promise;
        },
        error: (handler) => {
          errorHandler = handler;
          return errorRegistration.promise;
        },
      },
      callbacks: { analysis: () => onAnalysis, notice: () => onNotice },
      stateQueue: resolvedStateQueue(),
      initialTemplates: [],
    });

    bridge.dispose();
    analysisHandler(analysisResult);
    errorHandler("late error");
    analysisRegistration.resolve(analysisDisposer);
    errorRegistration.resolve(errorDisposer);
    await Promise.resolve();

    expect(onAnalysis).not.toHaveBeenCalled();
    expect(onNotice).not.toHaveBeenCalled();
    expect(analysisDisposer).toHaveBeenCalledTimes(1);
    expect(errorDisposer).toHaveBeenCalledTimes(1);
  });

  it("handles listener registration rejection without an unhandled rejection", async () => {
    const bridge = mountPurchaseHelperNativeBridge({
      registrars: {
        analysis: async () => Promise.reject(new Error("analysis listener failed")),
        error: async () => Promise.reject(new Error("error listener failed")),
      },
      callbacks: { analysis: () => vi.fn(), notice: () => vi.fn() },
      stateQueue: resolvedStateQueue(),
      initialTemplates: [],
    });
    await Promise.resolve();
    await Promise.resolve();
    bridge.dispose();
  });

  it("continues after failure and serializes update, unmount, remount, and final unmount", async () => {
    const first = deferred<unknown>();
    const calls: Array<{
      readonly active: boolean;
      readonly templates: readonly PurchaseImportTemplate[];
    }> = [];
    const invoker = vi.fn(async (active, templates) => {
      calls.push({ active, templates });
      if (calls.length === 1) return first.promise;
    });
    const queue = createPurchaseHelperStateQueue(invoker);
    const initialTemplates = [template("initial")];
    const latestTemplates = [template("latest")];
    const remountTemplates = [template("remount")];

    const requests = [
      queue.update(true, initialTemplates),
      queue.update(true, latestTemplates),
      queue.update(false, []),
      queue.update(true, remountTemplates),
      queue.update(false, []),
    ];
    await Promise.resolve();
    expect(calls).toEqual([{ active: true, templates: initialTemplates }]);

    first.reject(new Error("initial invoke failed"));
    await Promise.all(requests);
    expect(calls).toEqual([
      { active: true, templates: initialTemplates },
      { active: true, templates: latestTemplates },
      { active: false, templates: [] },
      { active: true, templates: remountTemplates },
      { active: false, templates: [] },
    ]);
  });

  it("keeps only the remounted lifecycle active under StrictMode-like cleanup", async () => {
    const staleAnalysisRegistration = deferred<() => void>();
    const staleErrorRegistration = deferred<() => void>();
    const staleAnalysisDisposer = vi.fn();
    const staleErrorDisposer = vi.fn();
    const currentAnalysisDisposer = vi.fn();
    const currentErrorDisposer = vi.fn();
    const staleCallback = vi.fn();
    const currentCallback = vi.fn();
    let staleHandler = (_result: PurchaseAnalysisResult): void => undefined;
    let currentHandler = (_result: PurchaseAnalysisResult): void => undefined;
    const activeStates: boolean[] = [];
    const queue: PurchaseHelperStateQueue = {
      update: vi.fn(async (active) => {
        activeStates.push(active);
      }),
    };

    const staleBridge = mountPurchaseHelperNativeBridge({
      registrars: {
        analysis: (handler) => {
          staleHandler = handler;
          return staleAnalysisRegistration.promise;
        },
        error: () => staleErrorRegistration.promise,
      },
      callbacks: { analysis: () => staleCallback, notice: () => vi.fn() },
      stateQueue: queue,
      initialTemplates: [],
    });
    staleBridge.dispose();
    const currentBridge = mountPurchaseHelperNativeBridge({
      registrars: {
        analysis: async (handler) => {
          currentHandler = handler;
          return currentAnalysisDisposer;
        },
        error: async () => currentErrorDisposer,
      },
      callbacks: { analysis: () => currentCallback, notice: () => vi.fn() },
      stateQueue: queue,
      initialTemplates: [],
    });

    staleAnalysisRegistration.resolve(staleAnalysisDisposer);
    staleErrorRegistration.resolve(staleErrorDisposer);
    await Promise.resolve();
    staleHandler(analysisResult);
    currentHandler(analysisResult);

    expect(staleAnalysisDisposer).toHaveBeenCalledTimes(1);
    expect(staleErrorDisposer).toHaveBeenCalledTimes(1);
    expect(staleCallback).not.toHaveBeenCalled();
    expect(currentCallback).toHaveBeenCalledWith(analysisResult);
    expect(activeStates).toEqual([true, false, true]);
    expect(currentAnalysisDisposer).not.toHaveBeenCalled();
    currentBridge.dispose();
    expect(currentAnalysisDisposer).toHaveBeenCalledTimes(1);
    expect(currentErrorDisposer).toHaveBeenCalledTimes(1);
  });
});
