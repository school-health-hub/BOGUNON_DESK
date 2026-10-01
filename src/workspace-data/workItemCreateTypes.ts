import type { AuthStatus } from "../auth/types";

export const quickAddAreas = ["healthWork", "schoolSchedule", "personal", "exercise"] as const;
export type QuickAddArea = (typeof quickAddAreas)[number];

export const quickAddTaskCategories = [
  "studentHealthScreening",
  "additionalScreening",
  "infectiousDisease",
  "firstAid",
  "medication",
  "officialDocument",
  "training",
  "event",
  "counseling",
  "other",
] as const;
export type QuickAddTaskCategory = (typeof quickAddTaskCategories)[number];

export const quickAddTaskPriorities = ["high", "normal", "low"] as const;
export type QuickAddTaskPriority = (typeof quickAddTaskPriorities)[number];

export type QuickAddTaskInput = {
  readonly kind: "task";
  readonly title: string;
  readonly date: string;
  readonly dueDate: string;
  readonly area: string;
  readonly category: string;
  readonly priority: string;
};

export type QuickAddEventInput = {
  readonly kind: "event";
  readonly title: string;
  readonly date: string;
  readonly area: string;
};

export type QuickAddInput = QuickAddTaskInput | QuickAddEventInput;

export type QuickTaskCreateValues = {
  readonly title: string;
  readonly area: QuickAddArea;
  readonly category: QuickAddTaskCategory;
  readonly priority: QuickAddTaskPriority;
  readonly scheduledDate: string;
  readonly dueDate: string | null;
};

export type QuickEventCreateValues = {
  readonly title: string;
  readonly area: QuickAddArea;
  readonly date: string;
};

export interface WorkItemCreateRepository {
  createTask(userId: string, values: QuickTaskCreateValues): Promise<string>;
  createEvent(userId: string, values: QuickEventCreateValues): Promise<string>;
}

export type SubmitQuickWorkItemOptions = {
  readonly authStatus: AuthStatus;
  readonly userId: string | null;
  readonly input: QuickAddInput;
  readonly repository: WorkItemCreateRepository;
  readonly refresh: () => void;
};

export type SubmitQuickWorkItemResult =
  | { readonly status: "signedOut" }
  | { readonly status: "success"; readonly kind: "task" | "event"; readonly id: string };
