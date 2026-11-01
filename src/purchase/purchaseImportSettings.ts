import { purchaseImportFieldIds, type PurchaseColumnMapping, type PurchaseImportTemplate } from "./types";

const STORAGE_KEY = "school-health-desk.purchase-import-templates.v1";
const MAX_TEMPLATES = 20;
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null && !Array.isArray(value);

export class PurchaseImportTemplateStorageError extends Error {
  constructor() {
    super("가져오기 양식 원본을 안전하게 보존할 수 없어 설정 저장을 중단했습니다.");
    this.name = "PurchaseImportTemplateStorageError";
  }
}

const isStoredTemplate = (value: unknown): value is PurchaseImportTemplate => {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string"
    || !Array.isArray(value.headerSignature) || !value.headerSignature.every((entry) => typeof entry === "string")
    || !isRecord(value.mapping)) return false;
  const mapping = value.mapping;
  return Object.keys(value).every((key) => ["id", "name", "headerSignature", "mapping"].includes(key))
    && Object.keys(mapping).every((key) => purchaseImportFieldIds.some((field) => field === key))
    && purchaseImportFieldIds.every((field) => !Object.prototype.hasOwnProperty.call(mapping, field)
    || (typeof mapping[field] === "number" && Number.isFinite(mapping[field])));
};

// Persistence checks representation only. Semantic repairs belong to neither sync nor storage.
export const preservePurchaseImportTemplates = (value: unknown): readonly PurchaseImportTemplate[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isStoredTemplate)) throw new PurchaseImportTemplateStorageError();
  return value;
};

export const normalizePurchaseImportTemplates = (value: unknown): readonly PurchaseImportTemplate[] => {
  if (!Array.isArray(value)) return [];
  const signatures = new Set<string>();
  const result: PurchaseImportTemplate[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.name !== "string" || !Array.isArray(raw.headerSignature) || !isRecord(raw.mapping)) continue;
    const id = raw.id.trim(); const name = raw.name.trim();
    if (!raw.headerSignature.every((entry): entry is string => typeof entry === "string")) continue;
    const headerSignature = raw.headerSignature.map((entry) => entry.trim());
    while (headerSignature[headerSignature.length - 1] === "") headerSignature.pop();
    if (id === "" || name === "" || name.length > 40 || headerSignature.length === 0) continue;
    const mapping: Partial<Record<(typeof purchaseImportFieldIds)[number], number>> = {};
    const used = new Set<number>();
    let hasDuplicateSource = false;
    let hasInvalidIndex = false;
    for (const field of purchaseImportFieldIds) {
      if (!Object.prototype.hasOwnProperty.call(raw.mapping, field)) continue;
      const index = raw.mapping[field];
      if (typeof index === "number" && Number.isSafeInteger(index) && index >= 0) {
        if (used.has(index)) hasDuplicateSource = true;
        else { mapping[field] = index; used.add(index); }
      } else hasInvalidIndex = true;
    }
    if (mapping.name === undefined || hasDuplicateSource || hasInvalidIndex) continue;
    const key = JSON.stringify(headerSignature);
    if (signatures.has(key)) continue;
    const validMapping: PurchaseColumnMapping = mapping;
    signatures.add(key); result.push({ id, name, headerSignature, mapping: validMapping });
    if (result.length === MAX_TEMPLATES) break;
  }
  return result;
};

// Keep conflicting signatures visible to the Rust analyzer; do not deduplicate or cap here.
export const purchaseAnalysisTemplates = (templates: readonly PurchaseImportTemplate[]): readonly PurchaseImportTemplate[] =>
  templates.flatMap((template) => normalizePurchaseImportTemplates([template]));

export const readPurchaseImportTemplatesForDisplay = (load: () => readonly PurchaseImportTemplate[]) => {
  try { return { templates: load(), warning: null }; }
  catch (error) {
    if (error instanceof PurchaseImportTemplateStorageError) return { templates: [], warning: error.message };
    throw error;
  }
};

export const loadPurchaseImportTemplates = (): readonly PurchaseImportTemplate[] => {
  try { return preservePurchaseImportTemplates(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")); }
  catch (error) { if (error instanceof SyntaxError) throw new PurchaseImportTemplateStorageError(); throw error; }
};
export const savePurchaseImportTemplates = (templates: readonly PurchaseImportTemplate[]): void => {
  // Refuse to overwrite an unreadable existing record during automatic account replacement.
  const existing = loadPurchaseImportTemplates();
  const serialized = JSON.stringify(preservePurchaseImportTemplates(templates));
  if (JSON.stringify(existing) === serialized) return;
  localStorage.setItem(STORAGE_KEY, serialized);
};
