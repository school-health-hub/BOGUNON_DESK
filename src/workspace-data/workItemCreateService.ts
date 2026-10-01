import { parseLocalDate } from "../dashboard/dateSource";
import {
  quickAddAreas,
  quickAddTaskCategories,
  quickAddTaskPriorities,
  type QuickAddArea,
  type QuickAddEventInput,
  type QuickAddInput,
  type QuickAddTaskCategory,
  type QuickAddTaskInput,
  type QuickAddTaskPriority,
  type QuickEventCreateValues,
  type QuickTaskCreateValues,
  type SubmitQuickWorkItemOptions,
  type SubmitQuickWorkItemResult,
} from "./workItemCreateTypes";

export class QuickAddValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuickAddValidationError";
  }
}

const includesValue = <Value extends string>(values: readonly Value[], candidate: string): candidate is Value => (
  values.some((value) => value === candidate)
);

export const isQuickAddArea = (value: string): value is QuickAddArea => includesValue(quickAddAreas, value);
export const isQuickAddTaskCategory = (value: string): value is QuickAddTaskCategory => includesValue(quickAddTaskCategories, value);
export const isQuickAddTaskPriority = (value: string): value is QuickAddTaskPriority => includesValue(quickAddTaskPriorities, value);

const validateTitle = (value: string): string => {
  const title = value.trim();
  if (title.length === 0) throw new QuickAddValidationError("제목을 입력해 주세요.");
  if (title.length > 120) throw new QuickAddValidationError("제목은 120자 이내로 입력해 주세요.");
  return title;
};

const validateDate = (value: string): string => {
  if (parseLocalDate(value) === null) throw new QuickAddValidationError("날짜를 확인해 주세요.");
  return value;
};

export const createInitialTaskInput = (date: string): QuickAddTaskInput => ({
  kind: "task",
  title: "",
  date,
  dueDate: "",
  area: "healthWork",
  category: "other",
  priority: "normal",
});

export const createInitialEventInput = (date: string): QuickAddEventInput => ({
  kind: "event",
  title: "",
  date,
  area: "schoolSchedule",
});

const parseTask = (input: QuickAddTaskInput): QuickTaskCreateValues => {
  if (!isQuickAddArea(input.area)) throw new QuickAddValidationError("업무 영역을 확인해 주세요.");
  if (!isQuickAddTaskCategory(input.category)) throw new QuickAddValidationError("업무 카테고리를 확인해 주세요.");
  if (!isQuickAddTaskPriority(input.priority)) throw new QuickAddValidationError("우선순위를 확인해 주세요.");
  return {
    title: validateTitle(input.title),
    area: input.area,
    category: input.category,
    priority: input.priority,
    scheduledDate: validateDate(input.date),
    dueDate: input.dueDate === "" ? null : validateDate(input.dueDate),
  };
};

const parseEvent = (input: QuickAddEventInput): QuickEventCreateValues => {
  if (!isQuickAddArea(input.area)) throw new QuickAddValidationError("일정 영역을 확인해 주세요.");
  return {
    title: validateTitle(input.title),
    area: input.area,
    date: validateDate(input.date),
  };
};

export const submitQuickWorkItem = async (
  options: SubmitQuickWorkItemOptions,
): Promise<SubmitQuickWorkItemResult> => {
  if (options.authStatus !== "signedIn" || options.userId === null) return { status: "signedOut" };
  const id = options.input.kind === "task"
    ? await options.repository.createTask(options.userId, parseTask(options.input))
    : await options.repository.createEvent(options.userId, parseEvent(options.input));
  options.refresh();
  return { status: "success", kind: options.input.kind, id };
};

export const formatLocalInputDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export type { QuickAddInput };
