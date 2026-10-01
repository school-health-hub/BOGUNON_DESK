import { getSupabaseClient } from "../auth/supabaseClient";
import type {
  QuickEventCreateValues,
  QuickTaskCreateValues,
  WorkItemCreateRepository,
} from "./workItemCreateTypes";

type WorkItemCreateClient = Pick<ReturnType<typeof getSupabaseClient>, "from">;

export class WorkItemCreateError extends Error {
  constructor() {
    super("저장하지 못했습니다. 다시 시도해 주세요.");
    this.name = "WorkItemCreateError";
  }
}

const verifiedId = (data: { readonly id?: unknown } | null, error: unknown): string => {
  if (error !== null || data === null || typeof data.id !== "string" || data.id.length === 0) {
    throw new WorkItemCreateError();
  }
  return data.id;
};

export const createWorkItemCreateRepository = (
  client: WorkItemCreateClient,
): WorkItemCreateRepository => ({
  async createTask(userId: string, values: QuickTaskCreateValues): Promise<string> {
    const { data, error } = await client
      .from("tasks")
      .insert({
        user_id: userId,
        title: values.title,
        area: values.area,
        status: "planned",
        priority: values.priority,
        category: values.category,
        scheduled_date: values.scheduledDate,
        due_date: values.dueDate,
        follow_up_date: null,
        completed_at: null,
      })
      .select("id")
      .single();
    return verifiedId(data, error);
  },

  async createEvent(userId: string, values: QuickEventCreateValues): Promise<string> {
    const { data, error } = await client
      .from("events")
      .insert({
        user_id: userId,
        title: values.title,
        area: values.area,
        start_date: values.date,
        end_date: values.date,
        is_all_day: true,
        start_time: null,
        end_time: null,
      })
      .select("id")
      .single();
    return verifiedId(data, error);
  },
});

export const workItemCreateRepository: WorkItemCreateRepository = {
  createTask(userId, values) {
    return createWorkItemCreateRepository(getSupabaseClient()).createTask(userId, values);
  },
  createEvent(userId, values) {
    return createWorkItemCreateRepository(getSupabaseClient()).createEvent(userId, values);
  },
};
