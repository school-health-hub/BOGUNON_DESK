import type { AuthStatus } from "../auth/types";

export type MealNativeResponse =
  | { readonly status: "ready"; readonly date: string; readonly schoolName: string; readonly menu: readonly string[]; readonly calories: string | null }
  | { readonly status: "empty"; readonly date: string; readonly schoolName: string }
  | { readonly status: "disabled"; readonly date: string; readonly schoolName: string }
  | { readonly status: "school-missing"; readonly date: string }
  | { readonly status: "error"; readonly code: string; readonly message: string };

export type MealState =
  | { readonly status: "loading" }
  | { readonly status: "signedOut" }
  | { readonly status: "connectionRequired" }
  | MealNativeResponse;

export type MealRepository = {
  readonly load: (date: string) => Promise<MealNativeResponse>;
};

export type LoadMealOptions = {
  readonly authStatus: AuthStatus;
  readonly date: string;
  readonly repository: MealRepository;
};
