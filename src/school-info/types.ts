export type BogunonSchoolInfoRow = {
  readonly neis_office_code: string | null;
  readonly neis_school_code: string | null;
  readonly neis_school_name: string | null;
  readonly neis_office_name: string | null;
};

export type SchoolInfo = {
  readonly officeCode: string;
  readonly officeName: string;
  readonly schoolCode: string;
  readonly schoolName: string;
};

export type SchoolInfoState =
  | { readonly status: "loading" }
  | { readonly status: "signedOut" }
  | { readonly status: "ready"; readonly school: SchoolInfo }
  | { readonly status: "missing" }
  | { readonly status: "error" };

export type SchoolInfoRepository = {
  readonly load: (userId: string) => Promise<BogunonSchoolInfoRow | null>;
};
