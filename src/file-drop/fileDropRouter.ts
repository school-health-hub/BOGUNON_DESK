export type FileDropTarget = "purchase-helper" | "official-document" | "record-helper";
export type FileDropCandidate = { readonly target: FileDropTarget; readonly label: string; readonly description: string; readonly enabled: boolean; readonly recommended: boolean; readonly reason: string | null; };
export type FileDropRouteModel = { readonly names: readonly string[]; readonly candidates: readonly FileDropCandidate[]; };
const purchaseExtensions = new Set(["xlsx","xls","csv","pdf","png","jpg","jpeg"]);
const officialExtensions = new Set(["pdf","hwpx"]);
const recordExtensions = new Set(["pdf","hwpx","docx","hwp"]);
const baseName = (path: string) => path.split(/[\\/]/).at(-1)?.trim() || "이름 없는 파일";
const extensionOf = (path: string) => { const name = baseName(path); const i = name.lastIndexOf("."); return i > 0 && i < name.length - 1 ? name.slice(i + 1).toLowerCase() : ""; };
const allSupported = (paths: readonly string[], set: ReadonlySet<string>) => paths.length > 0 && paths.every((path) => set.has(extensionOf(path)));
export const buildFileDropRouteModel = (paths: readonly string[]): FileDropRouteModel => {
  const names = paths.map(baseName);
  const purchaseEnabled = allSupported(paths, purchaseExtensions);
  const officialEnabled = paths.length === 1 && allSupported(paths, officialExtensions);
  const recordEnabled = paths.length <= 50 && allSupported(paths, recordExtensions);
  const extensions = paths.map(extensionOf);
  const purchaseSpecific = extensions.every((ext) => ["xlsx","xls","csv","png","jpg","jpeg"].includes(ext));
  const recordSpecific = extensions.every((ext) => ["docx","hwp"].includes(ext));
  const recommended: FileDropTarget | null = purchaseSpecific && purchaseEnabled ? "purchase-helper" : recordSpecific && recordEnabled ? "record-helper" : paths.length > 1 && recordEnabled ? "record-helper" : paths.length === 1 && officialEnabled ? "official-document" : null;
  return { names, candidates: [
    { target:"purchase-helper", label:"품의 도우미", description:"견적·구매 파일의 품목을 분석합니다.", enabled:purchaseEnabled, recommended:recommended==="purchase-helper", reason:purchaseEnabled?null:"XLSX · XLS · CSV · PDF · 이미지 파일을 지원합니다." },
    { target:"official-document", label:"공문 작업실", description:"공문 원문을 불러와 핵심정리부터 시작합니다.", enabled:officialEnabled, recommended:recommended==="official-document", reason:officialEnabled?null:"PDF 또는 HWPX 파일 1개만 사용할 수 있습니다." },
    { target:"record-helper", label:"생기부 도우미", description:"활동보고서를 학생별 기록 작업으로 가져옵니다.", enabled:recordEnabled, recommended:recommended==="record-helper", reason:recordEnabled?null:"PDF · HWP/HWPX · DOCX 파일을 최대 50개까지 지원합니다." },
  ]};
};
