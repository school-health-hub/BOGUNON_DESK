import { WeatherRepositoryError } from "./weatherRepository";
import type { LoadWeatherOptions, WeatherState } from "./types";

export const loadWeatherState = async (options: LoadWeatherOptions): Promise<WeatherState> => {
  if (options.authStatus !== "signedIn") return { status: "signedOut" };
  try {
    return await options.repository.load();
  } catch (error) {
    if (error instanceof WeatherRepositoryError) {
      if (error.kind === "signedOut") return { status: "signedOut" };
      if (error.kind === "connectionRequired") return { status: "connectionRequired" };
      return { status: "error", code: "WEATHER_TRANSPORT_ERROR", message: error.message };
    }
    return { status: "error", code: "WEATHER_UNKNOWN_ERROR", message: "날씨 정보를 불러오지 못했습니다." };
  }
};
