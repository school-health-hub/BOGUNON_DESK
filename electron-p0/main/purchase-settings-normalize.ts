// Pure normalizers selectively reused from src/purchase/purchaseDraftSettings.ts and purchaseImportSettings.ts. No Tauri storage access.
import type {PurchaseDraftDetailFieldId,PurchaseDraftTemplate,PurchaseColumnMapping,PurchaseImportTemplate} from "../renderer/purchase/purchase/types.js";
const purchaseDraftDetailFieldIds=["summary","amount","vendor","budgetItem"] as const;
const purchaseImportFieldIds=["name","specification","quantity","unitPrice","amount","vendor","note","budgetItem"] as const;
const MAX_DRAFT_TEMPLATES = 10;
const normalizePattern = (value: unknown, placeholder: "{{title}}" | "{{purpose}}"): string => {
  if (typeof value !== "string") return placeholder;
  const pattern = value.trim().slice(0, 160);
  return pattern.includes(placeholder) ? pattern : placeholder;
};
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeFieldOrder = (value: unknown): readonly PurchaseDraftDetailFieldId[] => {
  if (!Array.isArray(value)) return purchaseDraftDetailFieldIds;
  const valid = value.filter((entry, index): entry is PurchaseDraftDetailFieldId => typeof entry === "string" && purchaseDraftDetailFieldIds.includes(entry as PurchaseDraftDetailFieldId) && value.indexOf(entry) === index);
  return [...valid, ...purchaseDraftDetailFieldIds.filter((field) => !valid.includes(field))];
};

export const normalizePurchaseDraftTemplates = (value: unknown): readonly PurchaseDraftTemplate[] => {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const result: PurchaseDraftTemplate[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.name !== "string") continue;
    const id = raw.id.trim();
    const name = raw.name.trim();
    if (id === "" || ids.has(id) || name === "" || name.length > 40) continue;
    const attachmentPhrase = typeof raw.attachmentPhrase === "string" ? raw.attachmentPhrase.trim().slice(0, 120) : "붙임  품목내역 1부.  끝.";
    result.push({
      id,
      name,
      titlePattern: normalizePattern(raw.titlePattern, "{{title}}"),
      introPattern: normalizePattern(raw.introPattern, "{{purpose}}"),
      detailFieldOrder: normalizeFieldOrder(raw.detailFieldOrder),
      attachmentPhrase,
      includeAttachment: raw.includeAttachment !== false,
    });
    ids.add(id);
    if (result.length === MAX_DRAFT_TEMPLATES) break;
  }
  return result;
};

const MAX_IMPORT_TEMPLATES = 20;


export const normalizePurchaseImportTemplates = (value: unknown): readonly PurchaseImportTemplate[] => {
  if (!Array.isArray(value)) return [];
  const signatures = new Set<string>();
  const result: PurchaseImportTemplate[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.name !== "string" || !Array.isArray(raw.headerSignature) || !isRecord(raw.mapping)) continue;
    const id = raw.id.trim(); const name = raw.name.trim();
    const headerSignature = raw.headerSignature.filter((entry): entry is string => typeof entry === "string" && entry !== "").map((entry) => entry.trim());
    if (id === "" || name === "" || name.length > 40 || headerSignature.length === 0) continue;
    const mapping: Partial<Record<(typeof purchaseImportFieldIds)[number], number>> = {};
    const used = new Set<number>();
    let hasDuplicateSource = false;
    for (const field of purchaseImportFieldIds) {
      const index = raw.mapping[field];
      if (typeof index === "number" && Number.isInteger(index) && index >= 0 && index < headerSignature.length) {
        if (used.has(index)) hasDuplicateSource = true;
        else { mapping[field] = index; used.add(index); }
      }
    }
    if (mapping.name === undefined || hasDuplicateSource) continue;
    const key = JSON.stringify(headerSignature);
    if (signatures.has(key)) continue;
    const validMapping: PurchaseColumnMapping = mapping;
    signatures.add(key); result.push({ id, name, headerSignature, mapping: validMapping });
    if (result.length === MAX_IMPORT_TEMPLATES) break;
  }
  return result;
};
