import type {
  PurchaseAnalysisRequestResult,
  PurchaseAnalysisErrorEvent,
  PurchaseAnalysisEvent,
  PurchaseImportTemplate,
} from "../../purchase/types";

export const shouldClearPurchaseImportBusy = (
  result: PurchaseAnalysisRequestResult,
  latestGeneration: number,
): boolean => !result.started && result.generation === latestGeneration;

export const shouldApplyPurchaseAnalysisEvent = (
  eventGeneration: number,
  latestGeneration: number,
  acceptingResults: boolean,
): boolean => acceptingResults && eventGeneration === latestGeneration;

type ListenerDisposer = () => void;

type PurchaseEventRegistrars = {
  readonly start: (handler: (generation: number) => void) => Promise<ListenerDisposer>;
  readonly analysis: (
    handler: (event: PurchaseAnalysisEvent) => void,
  ) => Promise<ListenerDisposer>;
  readonly error: (handler: (event: PurchaseAnalysisErrorEvent) => void) => Promise<ListenerDisposer>;
};

type PurchaseEventCallbacks = {
  readonly start: () => (generation: number) => void;
  readonly analysis: () => (event: PurchaseAnalysisEvent) => void;
  readonly notice: () => (event: PurchaseAnalysisErrorEvent) => void;
};

type PurchaseHelperNativeBridgeOptions = {
  readonly registrars: PurchaseEventRegistrars;
  readonly callbacks: PurchaseEventCallbacks;
  readonly stateQueue: PurchaseHelperStateQueue;
  readonly invalidateAnalysis: () => Promise<number>;
  readonly initialTemplates: readonly PurchaseImportTemplate[];
};

type PurchaseHelperStateInvoker = (
  active: boolean,
  templates: readonly PurchaseImportTemplate[],
) => Promise<unknown>;

export type PurchaseHelperStateQueue = {
  readonly update: (
    active: boolean,
    templates: readonly PurchaseImportTemplate[],
  ) => Promise<void>;
};

export type PurchaseHelperNativeBridge = {
  readonly syncTemplates: (templates: readonly PurchaseImportTemplate[]) => void;
  readonly whenReady: () => Promise<void>;
  readonly invalidateAnalysis: () => Promise<number | null>;
  readonly dispose: () => void;
};

export function createPurchaseHelperStateQueue(
  invokeState: PurchaseHelperStateInvoker,
): PurchaseHelperStateQueue {
  let tail = Promise.resolve();
  return {
    update(active, templates) {
      const run = async (): Promise<void> => {
        await invokeState(active, templates);
      };
      const result = tail.then(run, run);
      tail = result.catch(() => undefined);
      return result;
    },
  };
}

export function mountPurchaseHelperNativeBridge(
  options: PurchaseHelperNativeBridgeOptions,
): PurchaseHelperNativeBridge {
  const { registrars, callbacks, stateQueue, invalidateAnalysis, initialTemplates } = options;
  let mounted = true;
  let currentTemplates = initialTemplates;
  const disposers: ListenerDisposer[] = [];

  const attach = (registration: Promise<ListenerDisposer>): Promise<void> =>
    registration
      .then((dispose) => {
        if (mounted) disposers.push(dispose);
        else dispose();
      });

  const registrations = [attach(
    registrars.start((generation) => {
      if (mounted) callbacks.start()(generation);
    }),
  ), attach(
    registrars.analysis((event) => {
      if (mounted) callbacks.analysis()(event);
    }),
  ), attach(
    registrars.error((event) => {
      if (mounted) callbacks.notice()(event);
    }),
  )];
  const ready = Promise.all([...registrations, stateQueue.update(true, initialTemplates)]).then(() => undefined);

  return {
    syncTemplates(templates) {
      if (!mounted || templates === currentTemplates) return;
      currentTemplates = templates;
      void stateQueue.update(true, templates).catch(() => undefined);
    },
    async whenReady() {
      await ready;
    },
    async invalidateAnalysis() {
      if (!mounted) return null;
      return invalidateAnalysis();
    },
    dispose() {
      if (!mounted) return;
      mounted = false;
      for (const dispose of disposers.splice(0)) dispose();
      void stateQueue.update(false, []).catch(() => undefined);
    },
  };
}
