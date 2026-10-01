import type { AuthStatus } from "../auth/types";
import type { WorkspaceFilters } from "../settings/workspaceFilters";
import { enabledWorkspaceAreas } from "../settings/workspaceFilters";
import { adaptWorkspaceData, createWorkspaceDateRange } from "./workspaceDataAdapter";
import type { WorkspaceDataRepository, WorkspaceDataState } from "./types";

type LoadWorkspaceDataOptions = {
  readonly authStatus: AuthStatus;
  readonly userId: string | null;
  readonly now: Date;
  readonly repository: WorkspaceDataRepository;
  readonly filters: WorkspaceFilters;
};

export const loadWorkspaceData = async ({
  authStatus,
  userId,
  now,
  repository,
  filters,
}: LoadWorkspaceDataOptions): Promise<WorkspaceDataState> => {
  if (authStatus === "loading" || authStatus === "signingIn" || authStatus === "signingOut") {
    return { status: "loading" };
  }
  if (authStatus !== "signedIn" || userId === null) return { status: "signedOut" };

  try {
    const enabledAreas = enabledWorkspaceAreas(filters);
    const rows = await repository.load(userId, createWorkspaceDateRange(now), enabledAreas);
    return { status: "ready", data: adaptWorkspaceData(rows, now, enabledAreas) };
  } catch {
    return { status: "error" };
  }
};
