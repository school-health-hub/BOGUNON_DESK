import { describe, expect, it } from "vitest";
import { defaultWorkspaceFilters, enabledWorkspaceAreas, normalizeWorkspaceFilters } from "./workspaceFilters";

describe("workspace filters", () => {
  it("defaults to health work and school schedules only", () => {
    expect(defaultWorkspaceFilters).toEqual({
      healthWork: true,
      schoolSchedule: true,
      personal: false,
      exercise: false,
      project: false,
    });
    expect(enabledWorkspaceAreas(defaultWorkspaceFilters)).toEqual(["healthWork", "schoolSchedule"]);
  });

  it("normalizes missing legacy fields without invalidating known values", () => {
    expect(normalizeWorkspaceFilters({ personal: true })).toEqual({
      ...defaultWorkspaceFilters,
      personal: true,
    });
  });
});
