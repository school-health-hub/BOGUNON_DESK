export const workspaceAreas = ["healthWork", "schoolSchedule", "personal", "exercise", "project"] as const;
export type WorkspaceArea = (typeof workspaceAreas)[number];

export type WorkspaceFilters = Readonly<Record<WorkspaceArea, boolean>>;

export const defaultWorkspaceFilters: WorkspaceFilters = {
  healthWork: true,
  schoolSchedule: true,
  personal: false,
  exercise: false,
  project: false,
};

export const WORKSPACE_FILTERS_STORAGE_KEY = "school-health-desk.workspace-filters.v1";
const filterListeners = new Set<(filters: WorkspaceFilters) => void>();

export const normalizeWorkspaceFilters = (value: unknown): WorkspaceFilters => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return defaultWorkspaceFilters;
  const read = (area: WorkspaceArea): boolean => (
    typeof Reflect.get(value, area) === "boolean" ? Reflect.get(value, area) : defaultWorkspaceFilters[area]
  );
  return {
    healthWork: read("healthWork"),
    schoolSchedule: read("schoolSchedule"),
    personal: read("personal"),
    exercise: read("exercise"),
    project: read("project"),
  };
};

export const enabledWorkspaceAreas = (filters: WorkspaceFilters): readonly WorkspaceArea[] =>
  workspaceAreas.filter((area) => filters[area]);

export const loadWorkspaceFilters = (): WorkspaceFilters => {
  const raw = window.localStorage.getItem(WORKSPACE_FILTERS_STORAGE_KEY);
  if (raw === null) return defaultWorkspaceFilters;
  try {
    return normalizeWorkspaceFilters(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) return defaultWorkspaceFilters;
    throw error;
  }
};

export const saveWorkspaceFilters = (filters: WorkspaceFilters): void => {
  const normalized = normalizeWorkspaceFilters(filters);
  window.localStorage.setItem(WORKSPACE_FILTERS_STORAGE_KEY, JSON.stringify(normalized));
  for (const listener of filterListeners) listener(normalized);
};

export const subscribeWorkspaceFilters = (listener: (filters: WorkspaceFilters) => void): (() => void) => {
  filterListeners.add(listener);
  return () => filterListeners.delete(listener);
};
