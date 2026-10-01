import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useReducer,
} from "react";
import {
  createOfficialDocumentSession,
  reduceOfficialDocumentSession,
} from "./officialDocumentSession";
import type {
  OfficialDocumentSession,
  OfficialDocumentSessionAction,
} from "./types";

type OfficialDocumentSessionContextValue = {
  readonly state: OfficialDocumentSession;
  readonly dispatch: Dispatch<OfficialDocumentSessionAction>;
};

const OfficialDocumentSessionContext =
  createContext<OfficialDocumentSessionContextValue | null>(null);

export function OfficialDocumentSessionProvider({
  children,
  initialState,
}: {
  readonly children: ReactNode;
  readonly initialState?: OfficialDocumentSession;
}) {
  const [state, dispatch] = useReducer(
    reduceOfficialDocumentSession,
    initialState ?? createOfficialDocumentSession(),
  );
  return (
    <OfficialDocumentSessionContext.Provider value={{ state, dispatch }}>
      {children}
    </OfficialDocumentSessionContext.Provider>
  );
}

export const useOfficialDocumentSession = (): OfficialDocumentSessionContextValue => {
  const value = useContext(OfficialDocumentSessionContext);
  if (value === null) {
    throw new Error("OfficialDocumentSessionProvider가 필요합니다.");
  }
  return value;
};
