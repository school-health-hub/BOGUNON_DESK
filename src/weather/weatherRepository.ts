import { invoke, isTauri } from "@tauri-apps/api/core";
import { getSupabaseClient } from "../auth/supabaseClient";
import type { WeatherNativeResponse, WeatherRepository } from "./types";

export class WeatherRepositoryError extends Error {
  readonly kind: "signedOut" | "connectionRequired" | "transport";

  constructor(kind: WeatherRepositoryError["kind"], message: string) {
    super(message);
    this.name = "WeatherRepositoryError";
    this.kind = kind;
  }
}

export const weatherRepository: WeatherRepository = {
  load: async () => {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error !== null || data.session === null) {
      throw new WeatherRepositoryError("signedOut", "로그인이 필요합니다.");
    }
    if (!isTauri()) {
      throw new WeatherRepositoryError("transport", "날씨 정보는 Windows 앱에서 확인할 수 있습니다.");
    }
    try {
      return await invoke<WeatherNativeResponse>("fetch_bogunon_weather", {
        accessToken: data.session.access_token,
      });
    } catch (error) {
      if (error === "BOGUNON 연결이 필요합니다.") {
        throw new WeatherRepositoryError("connectionRequired", error);
      }
      throw new WeatherRepositoryError("transport", "날씨 정보를 불러오지 못했습니다.");
    }
  },
};
