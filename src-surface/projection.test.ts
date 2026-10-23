import { describe, expect, it } from "vitest";
import { surfaceActionIds, syntheticSurfaceProjection } from "./projection";

describe("synthetic surface projection", () => {
  it("is visibly synthetic and includes exactly approved action ids", () => {
    expect(syntheticSurfaceProjection.kind).toBe("synthetic-preview");
    expect(syntheticSurfaceProjection.launchers.map(({ actionId }) => actionId)).toEqual(surfaceActionIds);
    expect(JSON.stringify(syntheticSurfaceProjection)).toContain("합성");
  });

  it("contains no authentication, finance, or personal-data fields", () => {
    const keys = JSON.stringify(syntheticSurfaceProjection).toLowerCase();
    for (const forbidden of ["token", "password", "finance", "student", "patient", "email", "phone"]) expect(keys).not.toContain(forbidden);
  });
});
