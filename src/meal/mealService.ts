import { MealRepositoryError } from "./mealRepository";
import type { LoadMealOptions, MealState } from "./types";

export const loadMealState = async (options: LoadMealOptions): Promise<MealState> => {
  if (options.authStatus !== "signedIn") return { status: "signedOut" };
  try {
    return await options.repository.load(options.date);
  } catch (error) {
    if (error instanceof MealRepositoryError) {
      if (error.kind === "signedOut") return { status: "signedOut" };
      if (error.kind === "connectionRequired") return { status: "connectionRequired" };
      return { status: "error", code: "MEAL_TRANSPORT_ERROR", message: error.message };
    }
    return { status: "error", code: "MEAL_UNKNOWN_ERROR", message: "급식 정보를 불러오지 못했습니다." };
  }
};
