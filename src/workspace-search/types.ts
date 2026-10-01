import type { AuthStatus } from "../auth/types";
import type { WorkspaceArea, WorkspaceFilters } from "../settings/workspaceFilters";
import type { BogunonTaskPriority, BogunonTaskStatus } from "../workspace-data/types";

export type BogunonSearchTaskRow = {
  readonly id: string;
  readonly title: string;
  readonly area: WorkspaceArea;
  readonly status: BogunonTaskStatus;
  readonly priority: BogunonTaskPriority;
  readonly scheduled_date: string | null;
  readonly due_date: string | null;
  readonly follow_up_date: string | null;
};

export type BogunonSearchEventRow = {
  readonly id: string;
  readonly title: string;
  readonly area: WorkspaceArea;
  readonly start_date: string;
  readonly end_date: string;
  readonly is_all_day: boolean;
  readonly start_time: string | null;
  readonly end_time: string | null;
};

export type BogunonSearchRows = {
  readonly tasks: readonly BogunonSearchTaskRow[];
  readonly events: readonly BogunonSearchEventRow[];
};

export type BogunonSearchItem = {
  readonly kind: "task" | "event";
  readonly id: string;
  readonly title: string;
  readonly date: string | null;
  readonly secondary: string;
};

export type BogunonSearchState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "signedOut" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly items: readonly BogunonSearchItem[] };

export interface BogunonSearchRepository {
  search(userId: string, query: string, enabledAreas: readonly WorkspaceArea[]): Promise<BogunonSearchRows>;
}

export type BogunonSearchRequest = {
  readonly authStatus: AuthStatus;
  readonly userId: string | null;
  readonly query: string;
  readonly filters: WorkspaceFilters;
  readonly repository: BogunonSearchRepository;
};
