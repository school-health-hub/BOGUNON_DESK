import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { createUpdaterController, type UpdaterController } from "./updaterController";
import { updaterCheckStorage } from "./updaterCheckStorage";
import { updaterService } from "./updaterService";
import type { DesktopUpdaterState } from "./updaterTypes";

type DesktopUpdaterContextValue = {
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

const createDefaultController = (): UpdaterController => createUpdaterController({
  service: updaterService,
  storage: updaterCheckStorage,
  now: Date.now,
});

export function DesktopUpdaterProvider({ children }: { readonly children: ReactNode }) {
  const [controller] = useState(createDefaultController);
  const [state, setState] = useState(controller.getState);

  useEffect(() => controller.subscribe(() => setState(controller.getState())), [controller]);
  useEffect(() => () => controller.cancelPending(), [controller]);

  const value = useMemo<DesktopUpdaterContextValue>(() => ({
    state,
    startupCheck: controller.startupCheck,
    manualCheck: controller.manualCheck,
    requestInstall: controller.requestInstall,
    cancelInstall: controller.cancelInstall,
    confirmInstall: controller.confirmInstall,
    dismissAvailable: controller.dismissAvailable,
    retry: controller.retry,
  }), [controller, state]);

  return <DesktopUpdaterContext.Provider value={value}>{children}</DesktopUpdaterContext.Provider>;
}

export const useDesktopUpdater = (): DesktopUpdaterContextValue => {
  const value = useContext(DesktopUpdaterContext);
  if (value === null) throw new Error("DesktopUpdaterProvider가 필요합니다.");
  return value;
};
