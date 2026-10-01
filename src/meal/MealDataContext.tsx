import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { useWidgetSession } from "../dashboard/WidgetSessionContext";
import { mealRepository } from "./mealRepository";
import { loadMealState } from "./mealService";
import type { MealState } from "./types";

type MealDataContextValue = {
  readonly state: MealState;
  readonly refresh: () => void;
};

const MealDataContext = createContext<MealDataContextValue | null>(null);

export const formatMealDate = (date: Date): string => {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function MealDataProvider({ children }: { readonly children: ReactNode }) {
  const auth = useAuth();
  const { now } = useWidgetSession();
  const date = formatMealDate(now);
  const [state, setState] = useState<MealState>({ status: "loading" });
  const [refreshSequence, setRefreshSequence] = useState(0);

  useEffect(() => {
    let active = true;
    if (auth.state.status === "signedIn") setState({ status: "loading" });
    void loadMealState({ authStatus: auth.state.status, date, repository: mealRepository }).then((nextState) => {
      if (active) setState(nextState);
    });
    return () => {
      active = false;
    };
  }, [auth.state.status, auth.state.user?.id, date, refreshSequence]);

  const value = useMemo<MealDataContextValue>(() => ({
    state,
    refresh: () => setRefreshSequence((current) => current + 1),
  }), [state]);

  return <MealDataContext.Provider value={value}>{children}</MealDataContext.Provider>;
}

export const useMealData = (): MealDataContextValue => {
  const value = useContext(MealDataContext);
  if (value === null) throw new Error("MealDataProvider가 필요합니다.");
  return value;
};
