import type { AuthStatus } from "../auth/types";

export type WeatherNativeResponse =
  | { readonly status: "ready"; readonly schoolName: string; readonly observedAt: string; readonly temperatureC: number; readonly apparentTemperatureC: number; readonly weatherCode: number; readonly conditionLabel: string; readonly highC: number; readonly lowC: number }
  | { readonly status: "school-missing" }
  | { readonly status: "disabled"; readonly schoolName: string }
  | { readonly status: "location-unavailable"; readonly schoolName: string }
  | { readonly status: "error"; readonly code: string; readonly message: string };

export type WeatherState =
  | { readonly status: "loading" }
  | { readonly status: "signedOut" }
  | { readonly status: "connectionRequired" }
  | WeatherNativeResponse;

export type WeatherRepository = {
  readonly load: () => Promise<WeatherNativeResponse>;
};

export type LoadWeatherOptions = {
  readonly authStatus: AuthStatus;
  readonly repository: WeatherRepository;
};
