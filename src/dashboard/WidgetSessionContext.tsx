import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
type WidgetSessionValue = {
  readonly now: Date;
  readonly memo: string;
  readonly setMemo: (memo: string) => void;
};

const WidgetSessionContext = createContext<WidgetSessionValue | null>(null);

type WidgetSessionProviderProps = {
  readonly children: ReactNode;
};

export function WidgetSessionProvider({ children }: WidgetSessionProviderProps) {
  const [now, setNow] = useState(() => new Date());
  const [memo, setMemo] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const value = useMemo<WidgetSessionValue>(() => ({
    now,
    memo,
    setMemo,
  }), [memo, now]);

  return <WidgetSessionContext.Provider value={value}>{children}</WidgetSessionContext.Provider>;
}

export const useWidgetSession = (): WidgetSessionValue => {
  const value = useContext(WidgetSessionContext);
  if (value === null) {
    throw new Error("WidgetSessionProvider 안에서만 위젯 세션 상태를 사용할 수 있습니다.");
  }
  return value;
};
