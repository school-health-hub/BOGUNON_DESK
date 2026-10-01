import type {
  QuickAddArea,
  QuickAddTaskCategory,
  QuickAddTaskPriority,
} from "../../workspace-data/workItemCreateTypes";

type QuickAddKind = "task" | "event";

export type QuickAddOpenOptions = {
  readonly initialDate?: string;
  readonly initialKind?: QuickAddKind;
  readonly initialTaskTitle?: string;
  readonly initialTaskArea?: QuickAddArea;
  readonly initialTaskCategory?: QuickAddTaskCategory;
  readonly initialTaskPriority?: QuickAddTaskPriority;
  readonly initialTaskDueDate?: string;
};

export type QuickAddOpenState = {
  readonly initialDate: string;
  readonly initialKind: QuickAddKind;
  readonly initialTaskTitle: string;
  readonly initialTaskArea: QuickAddArea;
  readonly initialTaskCategory: QuickAddTaskCategory;
  readonly initialTaskPriority: QuickAddTaskPriority;
  readonly initialTaskDueDate: string;
};

export const createQuickAddOpenState = (
  today: string,
  options: QuickAddOpenOptions = {},
): QuickAddOpenState => ({
  initialDate: options.initialDate ?? today,
  initialKind: options.initialKind ?? "task",
  initialTaskTitle: options.initialTaskTitle ?? "",
  initialTaskArea: options.initialTaskArea ?? "healthWork",
  initialTaskCategory: options.initialTaskCategory ?? "other",
  initialTaskPriority: options.initialTaskPriority ?? "normal",
  initialTaskDueDate: options.initialTaskDueDate ?? "",
});
