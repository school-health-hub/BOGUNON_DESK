import { describe, expect, it, vi } from "vitest";
import { loadSchoolInfoState, mapSchoolInfo } from "./schoolInfoService";
import type { BogunonSchoolInfoRow, SchoolInfoRepository } from "./types";

const completeRow: BogunonSchoolInfoRow = {
  neis_office_code: "B10",
  neis_school_code: "7010000",
  neis_school_name: "보건고등학교",
  neis_office_name: "서울특별시교육청",
};

describe("school info service", () => {
  it("does not query while signed out", async () => {
    const load = vi.fn();
    await expect(loadSchoolInfoState(null, { load })).resolves.toEqual({ status: "signedOut" });
    expect(load).not.toHaveBeenCalled();
  });

  it("loads the signed-in user's school information", async () => {
    const load = vi.fn().mockResolvedValue(completeRow);
    await expect(loadSchoolInfoState("user-1", { load })).resolves.toEqual({
      status: "ready",
      school: {
        officeCode: "B10",
        officeName: "서울특별시교육청",
        schoolCode: "7010000",
        schoolName: "보건고등학교",
      },
    });
    expect(load).toHaveBeenCalledWith("user-1");
  });

  it.each([
    null,
    { ...completeRow, neis_school_name: null },
    { ...completeRow, neis_school_code: " " },
  ])("maps absent or incomplete school settings to missing", async (row) => {
    const repository: SchoolInfoRepository = { load: vi.fn().mockResolvedValue(row) };
    await expect(loadSchoolInfoState("user-1", repository)).resolves.toEqual({ status: "missing" });
  });

  it("maps a read failure to an error state", async () => {
    const repository: SchoolInfoRepository = { load: vi.fn().mockRejectedValue(new Error("RLS")) };
    await expect(loadSchoolInfoState("user-1", repository)).resolves.toEqual({ status: "error" });
  });

  it("safely rejects null optional values instead of exposing partial school data", () => {
    expect(mapSchoolInfo({ ...completeRow, neis_office_name: null })).toBeNull();
  });
});
