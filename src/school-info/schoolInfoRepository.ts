import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../auth/supabaseClient";
import type { BogunonSchoolInfoRow, SchoolInfoRepository } from "./types";

export const SCHOOL_INFO_SELECT_COLUMNS =
  "neis_office_code,neis_school_code,neis_school_name,neis_office_name";

type SchoolInfoClient = Pick<SupabaseClient, "from">;

export const createSchoolInfoRepository = (
  client: SchoolInfoClient,
): SchoolInfoRepository => ({
  async load(userId) {
    const { data, error } = await client
      .from("user_settings")
      .select(SCHOOL_INFO_SELECT_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();

    if (error !== null) {
      throw new Error("학교 정보를 불러오지 못했습니다.");
    }
    return data as BogunonSchoolInfoRow | null;
  },
});

export const schoolInfoRepository: SchoolInfoRepository = {
  load: (userId) => createSchoolInfoRepository(getSupabaseClient()).load(userId),
};
