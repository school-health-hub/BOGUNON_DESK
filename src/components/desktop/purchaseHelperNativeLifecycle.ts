import type {
  PurchaseAnalysisResult,
  PurchaseImportTemplate,
} from "../../purchase/types";

type ListenerDisposer = () => void;

type PurchaseEventRegistrars = {
  readonly analysis: (
    handler: (result: PurchaseAnalysisResult) => void,
  ) => Promise<ListenerDisposer>;
  readonly error: (handler: (message: string) => void) => Promise<ListenerDisposer>;
};

type PurchaseEventCallbacks = {
  readonly analysis: () => (result: PurchaseAnalysisResult) => void;
  readonly notice: () => (message: string) => void;
};

type PurchaseHelperNativeBridgeOptions = {
  readonly registrars: PurchaseEventRegistrars;
  readonly callbacks: PurchaseEventCallbacks;
  readonly stateQueue: PurchaseHelperStateQueue;
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
      tail = tail.then(run, run).catch(() => undefined);
      return tail;
    },
  };
}

export function mountPurchaseHelperNativeBridge(
  options: PurchaseHelperNativeBridgeOptions,
): PurchaseHelperNativeBridge {
  const { registrars, callbacks, stateQueue, initialTemplates } = options;
  let mounted = true;
  let currentTemplates = initialTemplates;
  const disposers: ListenerDisposer[] = [];

  const attach = (registration: Promise<ListenerDisposer>): void => {
    void registration
      .then((dispose) => {
        if (mounted) disposers.push(dispose);
        else dispose();
      })
      .catch(() => undefined);
  };

  attach(
    registrars.analysis((result) => {
      if (mounted) callbacks.analysis()(result);
    }),
  );
  attach(
    registrars.error((message) => {
      if (mounted) callbacks.notice()(message);
    }),
  );
  void stateQueue.update(true, initialTemplates);

  return {
    syncTemplates(templates) {
      if (!mounted || templates === currentTemplates) return;
      currentTemplates = templates;
      void stateQueue.update(true, templates);
    },
    dispose() {
      if (!mounted) return;
      mounted = false;
      for (const dispose of disposers.splice(0)) dispose();
      void stateQueue.update(false, []);
    },
  };
}
