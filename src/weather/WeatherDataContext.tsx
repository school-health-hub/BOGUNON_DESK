import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { weatherRepository } from "./weatherRepository";
import { loadWeatherState } from "./weatherService";
import type { WeatherState } from "./types";

type WeatherDataContextValue = {
  readonly state: WeatherState;
  readonly refresh: () => void;
};

const WeatherDataContext = createContext<WeatherDataContextValue | null>(null);

export function WeatherDataProvider({ children }: { readonly children: ReactNode }) {
  const auth = useAuth();
  const [state, setState] = useState<WeatherState>({ status: "loading" });
  const [refreshSequence, setRefreshSequence] = useState(0);

  useEffect(() => {
    let active = true;
    if (auth.state.status === "signedIn") setState({ status: "loading" });
    void loadWeatherState({ authStatus: auth.state.status, repository: weatherRepository }).then((nextState) => {
      if (active) setState(nextState);
    });
    return () => {
      active = false;
    };
  }, [auth.state.status, auth.state.user?.id, refreshSequence]);

  const value = useMemo<WeatherDataContextValue>(() => ({
    state,
    refresh: () => setRefreshSequence((current) => current + 1),
  }), [state]);

  return <WeatherDataContext.Provider value={value}>{children}</WeatherDataContext.Provider>;
}

export const useWeatherData = (): WeatherDataContextValue => {
  const value = useContext(WeatherDataContext);
  if (value === null) throw new Error("WeatherDataProvider가 필요합니다.");
  return value;
};
