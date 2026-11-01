import { purchaseImportFieldIds, type PurchaseColumnMapping, type PurchaseImportTemplate } from "./types";

const STORAGE_KEY = "school-health-desk.purchase-import-templates.v1";
const MAX_TEMPLATES = 20;
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null && !Array.isArray(value);

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

export const loadPurchaseImportTemplates = (): readonly PurchaseImportTemplate[] => {
  try { return normalizePurchaseImportTemplates(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")); }
  catch (error) { if (error instanceof SyntaxError) return []; throw error; }
};
export const savePurchaseImportTemplates = (templates: readonly PurchaseImportTemplate[]): void => localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePurchaseImportTemplates(templates)));
