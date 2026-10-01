import { schoolInfoRepository } from "./schoolInfoRepository";
import type { BogunonSchoolInfoRow, SchoolInfo, SchoolInfoRepository, SchoolInfoState } from "./types";

const clean = (value: string | null): string | null => {
  const normalized = value?.trim();
  return normalized === undefined || normalized === "" ? null : normalized;
};

export const mapSchoolInfo = (row: BogunonSchoolInfoRow | null): SchoolInfo | null => {
  if (row === null) return null;
  const officeCode = clean(row.neis_office_code);
  const schoolCode = clean(row.neis_school_code);
  const schoolName = clean(row.neis_school_name);
  const officeName = clean(row.neis_office_name);
  if (officeCode === null || schoolCode === null || schoolName === null || officeName === null) {
    return null;
  }
  return { officeCode, officeName, schoolCode, schoolName };
};

export const loadSchoolInfoState = async (
  userId: string | null,
  repository: SchoolInfoRepository = schoolInfoRepository,
): Promise<SchoolInfoState> => {
  if (userId === null) return { status: "signedOut" };
  try {
    const school = mapSchoolInfo(await repository.load(userId));
    return school === null ? { status: "missing" } : { status: "ready", school };
  } catch {
    return { status: "error" };
  }
};
