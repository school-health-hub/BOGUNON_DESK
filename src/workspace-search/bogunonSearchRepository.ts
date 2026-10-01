import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../auth/supabaseClient";
import type { BogunonSearchEventRow, BogunonSearchRepository, BogunonSearchTaskRow } from "./types";

export const TASK_SEARCH_COLUMNS = "id,title,area,status,priority,scheduled_date,due_date,follow_up_date";
export const EVENT_SEARCH_COLUMNS = "id,title,area,start_date,end_date,is_all_day,start_time,end_time";

type SearchClient = Pick<SupabaseClient, "from">;

export const escapeLikePattern = (query: string): string => query.replace(/[\\%_]/g, "\\$&");

export const createBogunonSearchRepository = (client: SearchClient): BogunonSearchRepository => ({
  async search(userId, query, enabledAreas) {
    if (enabledAreas.length === 0) return { tasks: [], events: [] };
    const pattern = `%${escapeLikePattern(query)}%`;
    const [tasksResult, eventsResult] = await Promise.all([
      client.from("tasks")
        .select(TASK_SEARCH_COLUMNS)
        .eq("user_id", userId)
        .in("area", enabledAreas)
        .ilike("title", pattern)
        .order("title")
        .limit(6),
      client.from("events")
        .select(EVENT_SEARCH_COLUMNS)
        .eq("user_id", userId)
        .in("area", enabledAreas)
        .ilike("title", pattern)
        .order("start_date", { ascending: false })
        .order("title")
        .limit(6),
    ]);
    if (tasksResult.error !== null || eventsResult.error !== null) {
      throw new Error("BOGUNON 검색 결과를 불러오지 못했습니다.");
    }
    return {
      tasks: (tasksResult.data ?? []) as BogunonSearchTaskRow[],
      events: (eventsResult.data ?? []) as BogunonSearchEventRow[],
    };
  },
});

export const bogunonSearchRepository: BogunonSearchRepository = {
  search: (userId, query, enabledAreas) => createBogunonSearchRepository(getSupabaseClient())
    .search(userId, query, enabledAreas),
};
