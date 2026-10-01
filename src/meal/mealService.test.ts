import { describe, expect, it, vi } from "vitest";
import { MealRepositoryError } from "./mealRepository";
import { loadMealState } from "./mealService";
import type { MealNativeResponse, MealRepository } from "./types";

const response = (status: MealNativeResponse["status"]): MealNativeResponse => {
  switch (status) {
    case "ready": return { status, date: "2026-09-21", schoolName: "테스트고", menu: ["밥"], calories: null };
    case "empty": return { status, date: "2026-09-21", schoolName: "테스트고" };
    case "disabled": return { status, date: "2026-09-21", schoolName: "테스트고" };
    case "school-missing": return { status, date: "2026-09-21" };
    case "error": return { status, code: "MEAL_UPSTREAM_ERROR", message: "실패" };
  }
};

describe("meal service", () => {
  it("does not invoke the native repository when signed out", async () => {
    const load = vi.fn();
    await expect(loadMealState({ authStatus: "signedOut", date: "2026-09-21", repository: { load } })).resolves.toEqual({ status: "signedOut" });
    expect(load).not.toHaveBeenCalled();
  });

  it.each(["ready", "empty", "disabled", "school-missing", "error"] as const)(
    "preserves the native %s response",
    async (status) => {
      const expected = response(status);
      const repository: MealRepository = { load: vi.fn().mockResolvedValue(expected) };
      await expect(loadMealState({ authStatus: "signedIn", date: "2026-09-21", repository })).resolves.toEqual(expected);
      expect(repository.load).toHaveBeenCalledWith("2026-09-21");
    },
  );

  it("maps an unconfigured BOGUNON launcher to a dedicated state", async () => {
    const repository: MealRepository = { load: vi.fn().mockRejectedValue(new MealRepositoryError("connectionRequired", "missing")) };
    await expect(loadMealState({ authStatus: "signedIn", date: "2026-09-21", repository })).resolves.toEqual({ status: "connectionRequired" });
  });

  it("maps native transport failures to a safe generic error", async () => {
    const repository: MealRepository = { load: vi.fn().mockRejectedValue(new MealRepositoryError("transport", "급식 정보를 불러오지 못했습니다.")) };
    await expect(loadMealState({ authStatus: "signedIn", date: "2026-09-21", repository })).resolves.toEqual({
      status: "error",
      code: "MEAL_TRANSPORT_ERROR",
      message: "급식 정보를 불러오지 못했습니다.",
    });
  });
});
