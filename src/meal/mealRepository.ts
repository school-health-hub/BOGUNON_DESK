import { invoke, isTauri } from "@tauri-apps/api/core";
import { getSupabaseClient } from "../auth/supabaseClient";
import type { MealNativeResponse, MealRepository } from "./types";

export class MealRepositoryError extends Error {
  readonly kind: "signedOut" | "connectionRequired" | "transport";

  constructor(kind: MealRepositoryError["kind"], message: string) {
    super(message);
    this.name = "MealRepositoryError";
    this.kind = kind;
  }
}

export const mealRepository: MealRepository = {
  load: async (date) => {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error !== null || data.session === null) {
      throw new MealRepositoryError("signedOut", "로그인이 필요합니다.");
    }
    if (!isTauri()) {
      throw new MealRepositoryError("transport", "급식 정보는 Windows 앱에서 확인할 수 있습니다.");
    }
    try {
      return await invoke<MealNativeResponse>("fetch_bogunon_meal", {
        accessToken: data.session.access_token,
        date,
      });
    } catch (error) {
      if (error === "BOGUNON 연결이 필요합니다.") {
        throw new MealRepositoryError("connectionRequired", error);
      }
      throw new MealRepositoryError("transport", "급식 정보를 불러오지 못했습니다.");
    }
  },
};
