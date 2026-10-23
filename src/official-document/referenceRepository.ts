import type {
  OfficialDocumentReference,
  OfficialDocumentReferenceLoadResult,
  OfficialDocumentReferenceRepository,
} from "./referenceTypes";

export const OFFICIAL_DOCUMENT_REFERENCE_HEADERS = [
  "No", "사용여부", "문서목적", "업무분야", "자료명", "설명", "참고문서URL", "문서ID", "파일형태",
  "템플릿본문", "붙임예시", "메신저예시", "체크리스트", "공개구분", "비식별여부", "자동본문추출",
  "상태", "우선순위", "열기", "메모", "자료형태구분", "비식별원문URL", "원문노출여부", "표복사용본문",
  "표복사안내", "AI정리상태", "AI정리일시", "AI검토필요", "AI정리메모",
] as const;

type ReferenceHeader = (typeof OFFICIAL_DOCUMENT_REFERENCE_HEADERS)[number];
type HeaderIndex = Readonly<Record<ReferenceHeader, number>>;

const booleanValue = (value: string, label: string): boolean => {
  if (value === "TRUE") return true;
  if (value === "FALSE") return false;
  throw new ReferenceDataError(`${label} 값은 TRUE 또는 FALSE여야 합니다.`);
};

class ReferenceDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceDataError";
  }
}

const buildHeaderIndex = (headers: readonly string[]): HeaderIndex => {
  const duplicates = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicates.length > 0) throw new ReferenceDataError(`중복 header: ${duplicates[0]}`);
  const entries = OFFICIAL_DOCUMENT_REFERENCE_HEADERS.map((header) => {
    const index = headers.indexOf(header);
    if (index < 0) throw new ReferenceDataError(`필수 header 누락: ${header}`);
    return [header, index] as const;
  });
  return Object.fromEntries(entries) as HeaderIndex;
};

const parseRow = (row: readonly string[], index: HeaderIndex): OfficialDocumentReference => {
  const get = (header: ReferenceHeader): string => String(row[index[header]] ?? "").trim();
  const sourceNo = get("No");
  if (sourceNo === "") throw new ReferenceDataError("원본 No가 비어 있습니다.");
  const title = get("자료명");
  if (title === "") throw new ReferenceDataError(`No ${sourceNo}: 자료명이 비어 있습니다.`);
  const id = `official-document-reference:${sourceNo}`;
  return {
    id,
    sourceNo,
    enabled: booleanValue(get("사용여부"), `No ${sourceNo} 사용여부`),
    purposeLabel: get("문서목적"),
    workAreaLabel: get("업무분야"),
    title,
    description: get("설명"),
    sourceUrl: get("참고문서URL"),
    documentId: get("문서ID"),
    fileType: get("파일형태"),
    templateBody: get("템플릿본문"),
    attachmentExample: get("붙임예시"),
    messengerExample: get("메신저예시"),
    checklist: get("체크리스트"),
    visibility: get("공개구분"),
    deidentified: booleanValue(get("비식별여부"), `No ${sourceNo} 비식별여부`),
    state: get("상태"),
    priority: get("우선순위"),
    dataKind: get("자료형태구분"),
    tableCopyText: get("표복사용본문"),
    tableCopyGuide: get("표복사안내"),
  };
};

export const parseOfficialDocumentReferenceRows = (
  rows: readonly (readonly string[])[],
): OfficialDocumentReferenceLoadResult => {
  try {
    const headers = rows[0];
    if (headers === undefined) return { status: "error", message: "header 행이 없습니다." };
    const index = buildHeaderIndex(headers);
    const parsed = rows.slice(1).filter((row) => row.some((cell) => String(cell).trim() !== "")).map((row) => parseRow(row, index));
    const ids = new Set<string>();
    for (const reference of parsed) {
      if (ids.has(reference.id)) return { status: "error", message: `중복 reference ID: ${reference.id}` };
      ids.add(reference.id);
    }
    const enabled = parsed.filter((reference) => reference.enabled);
    return enabled.length === 0 ? { status: "empty" } : { status: "ready", references: enabled };
  } catch (error: unknown) {
    if (error instanceof ReferenceDataError) return { status: "error", message: error.message };
    throw error;
  }
};

const synthetic = (sourceNo: string, values: Partial<OfficialDocumentReference>): OfficialDocumentReference => ({
  id: `official-document-reference:${sourceNo}`,
  sourceNo,
  enabled: true,
  purposeLabel: "계획 기안",
  workAreaLabel: "학교보건 기본계획",
  title: "합성 공문 참고자료",
  description: "개인정보와 실제 행정정보를 포함하지 않은 개발용 자료",
  templateBody: "1. 관련: [입력 필요]\n2. [업무명]을 다음과 같이 시행하고자 합니다.\n  가. 대상: [입력 필요]\n  나. 일시: [입력 필요]",
  attachmentExample: "합성 안내문",
  messengerExample: "[업무명] 관련 안내드립니다. 세부 일정은 [입력 필요]입니다.",
  checklist: "개인정보 포함 여부 확인\n일정 및 대상 확인",
  sourceUrl: "",
  documentId: "",
  fileType: "PDF",
  dataKind: "본문형",
  tableCopyText: "",
  tableCopyGuide: "",
  visibility: "합성자료",
  deidentified: true,
  state: "개발 전용",
  priority: "중간",
  ...values,
});

export const syntheticOfficialDocumentReferences = [
  synthetic("3", { title: "학교보건 계획 기안 예시" }),
  synthetic("8", { purposeLabel: "결과 보고", workAreaLabel: "건강검진 결과보고", title: "건강검진 결과 보고 예시" }),
  synthetic("14", { purposeLabel: "안내문 발송", workAreaLabel: "호흡기 감염병 예방 수칙 안내", title: "예방 수칙 안내 예시", messengerExample: "예방 수칙 안내입니다. 대상과 일정은 [입력 필요]입니다." }),
  synthetic("21", { purposeLabel: "실적 보고", workAreaLabel: "폭력예방교육 실적 보고", title: "교육 실적 보고 예시" }),
  synthetic("34", { purposeLabel: "협조 요청", workAreaLabel: "신규 합성 업무", title: "미지원 분류 보존 예시" }),
  synthetic("55", { title: "복수 붙임 예시", attachmentExample: "합성 운영계획\n합성 안내문\n합성 확인서" }),
  synthetic("67", { purposeLabel: "결과 보고", title: "표 포함 결과 예시", dataKind: "표포함", attachmentExample: "합성 결과 집계표", tableCopyText: "구분\t인원\n완료\t[입력 필요]\n미완료\t[입력 필요]", tableCopyGuide: "탭 구분 텍스트를 표에 붙여넣으세요." }),
  synthetic("81", { title: "일부 필드가 빈 예시", description: "", attachmentExample: "", messengerExample: "", checklist: "" }),
  synthetic("97", { enabled: false, title: "사용 중지 합성 예시", state: "미사용" }),
] as const satisfies readonly OfficialDocumentReference[];

export const createSyntheticOfficialDocumentReferenceRepository = (
  options: { readonly connected: boolean } = { connected: true },
): OfficialDocumentReferenceRepository => ({
  list: async () => options.connected
    ? { status: "ready", references: syntheticOfficialDocumentReferences.filter((reference) => reference.enabled) }
    : { status: "notConnected" },
});

export const createNotConnectedOfficialDocumentReferenceRepository = (): OfficialDocumentReferenceRepository => ({
  list: async () => ({ status: "notConnected" }),
});

export const createDefaultOfficialDocumentReferenceRepository = (
  isDevelopment: boolean,
): OfficialDocumentReferenceRepository => isDevelopment
  ? createSyntheticOfficialDocumentReferenceRepository()
  : createNotConnectedOfficialDocumentReferenceRepository();
