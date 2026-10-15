import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { createUpdaterController, type UpdaterController } from "./updaterController";
import { updaterCheckStorage } from "./updaterCheckStorage";
import { createUpdaterServiceForMode, resolveUpdaterEnabled } from "./updaterService";
import type { DesktopUpdaterState } from "./updaterTypes";

type DesktopUpdaterContextValue = {
  readonly enabled: boolean;
  readonly state: DesktopUpdaterState;
  readonly startupCheck: () => Promise<void>;
  readonly manualCheck: () => Promise<void>;
  readonly requestInstall: () => void;
  readonly cancelInstall: () => void;
  readonly confirmInstall: () => Promise<void>;
  readonly dismissAvailable: () => Promise<void>;
  readonly retry: () => Promise<void>;
};

const DesktopUpdaterContext = createContext<DesktopUpdaterContextValue | null>(null);

const createDefaultRuntime = (
  mode: string,
  resolveCapability?: () => Promise<boolean>,
): {
  readonly controller: UpdaterController;
  readonly enabled: Promise<boolean>;
} => {
  const enabled = resolveUpdaterEnabled(mode, resolveCapability);
  return {
    controller: createUpdaterController({
      service: createUpdaterServiceForMode(mode, undefined, () => enabled),
      storage: updaterCheckStorage,
      now: Date.now,
    }),
    enabled,
  };
};

type DesktopUpdaterProviderProps = {
  readonly children: ReactNode;
  readonly mode?: string;
  readonly resolveCapability?: () => Promise<boolean>;
};

export function DesktopUpdaterProvider({
  children,
  mode = import.meta.env.MODE,
  resolveCapability,
}: DesktopUpdaterProviderProps) {
  const [runtime] = useState(() => createDefaultRuntime(mode, resolveCapability));
  const { controller } = runtime;
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState(controller.getState);

  useEffect(() => controller.subscribe(() => setState(controller.getState())), [controller]);
  useEffect(() => () => controller.cancelPending(), [controller]);
  useEffect(() => {
    let mounted = true;
    void runtime.enabled.then((value) => {
      if (mounted) setEnabled(value);
    });
    return () => { mounted = false; };
  }, [runtime]);

  const value = useMemo<DesktopUpdaterContextValue>(() => ({
    enabled,
    state,
    startupCheck: controller.startupCheck,
    manualCheck: controller.manualCheck,
    requestInstall: controller.requestInstall,
    cancelInstall: controller.cancelInstall,
    confirmInstall: controller.confirmInstall,
    dismissAvailable: controller.dismissAvailable,
    retry: controller.retry,
  }), [controller, enabled, state]);

  return <DesktopUpdaterContext.Provider value={value}>{children}</DesktopUpdaterContext.Provider>;
}

export const useDesktopUpdater = (): DesktopUpdaterContextValue => {
  const value = useContext(DesktopUpdaterContext);
  if (value === null) throw new Error("DesktopUpdaterProvider가 필요합니다.");
  return value;
};
