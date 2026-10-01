import { useEffect, useRef, useState } from "react";
import type { AuthStatus } from "../auth/types";
import { defaultWorkspaceFilters, loadWorkspaceFilters, subscribeWorkspaceFilters } from "../settings/workspaceFilters";
import { bogunonSearchRepository } from "./bogunonSearchRepository";
import { MIN_BOGUNON_SEARCH_LENGTH, searchBogunonItems } from "./bogunonSearchService";
import type { BogunonSearchState } from "./types";

export const BOGUNON_SEARCH_DEBOUNCE_MS = 220;

type UseBogunonSearchInput = {
  readonly authStatus: AuthStatus;
  readonly isOpen: boolean;
  readonly query: string;
  readonly userId: string | null;
};

export type SearchSequence = {
  readonly next: () => number;
  readonly isCurrent: (sequence: number) => boolean;
};

export const createSearchSequence = (): SearchSequence => {
  let current = 0;
  return {
    next: () => {
      current += 1;
      return current;
    },
    isCurrent: (sequence) => current === sequence,
  };
};

export const useBogunonSearch = ({ authStatus, isOpen, query, userId }: UseBogunonSearchInput): BogunonSearchState => {
  const [filters, setFilters] = useState(() => (
    typeof window === "undefined" ? defaultWorkspaceFilters : loadWorkspaceFilters()
  ));
  const [state, setState] = useState<BogunonSearchState>({ status: "idle" });
  const sequenceRef = useRef<SearchSequence>(createSearchSequence());

  useEffect(() => subscribeWorkspaceFilters(setFilters), []);

  useEffect(() => {
    const normalizedQuery = query.trim();
    const sequence = sequenceRef.current.next();
    if (!isOpen || normalizedQuery.length < MIN_BOGUNON_SEARCH_LENGTH) {
      setState({ status: "idle" });
      return undefined;
    }
    if (authStatus !== "signedIn" || userId === null) {
      setState({ status: "signedOut" });
      return undefined;
    }
    setState({ status: "loading" });
    const timeoutId = window.setTimeout(() => {
      void searchBogunonItems({ authStatus, userId, query: normalizedQuery, filters, repository: bogunonSearchRepository })
        .then((result) => {
          if (sequenceRef.current.isCurrent(sequence)) setState(result);
        })
        .catch(() => {
          if (sequenceRef.current.isCurrent(sequence)) setState({ status: "error" });
        });
    }, BOGUNON_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [authStatus, filters, isOpen, query, userId]);

  return state;
};
