import { describe, expect, it, vi } from "vitest";
import { createSchoolInfoRepository, SCHOOL_INFO_SELECT_COLUMNS } from "./schoolInfoRepository";

describe("school info repository", () => {
  it("selects only the persisted school fields and scopes the read to user_id", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    await createSchoolInfoRepository({ from } as never).load("user-1");

    expect(from).toHaveBeenCalledWith("user_settings");
    expect(select).toHaveBeenCalledWith(SCHOOL_INFO_SELECT_COLUMNS);
    expect(SCHOOL_INFO_SELECT_COLUMNS).toBe(
      "neis_office_code,neis_school_code,neis_school_name,neis_office_name",
    );
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(maybeSingle).toHaveBeenCalledOnce();
  });

  it("uses a read-only query chain", async () => {
    const table = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })),
      })),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    };
    await createSchoolInfoRepository({ from: vi.fn(() => table) } as never).load("user-1");
    expect(table.update).not.toHaveBeenCalled();
    expect(table.upsert).not.toHaveBeenCalled();
    expect(table.delete).not.toHaveBeenCalled();
  });
});
