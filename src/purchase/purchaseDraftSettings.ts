import {
  purchaseDraftDetailFieldIds,
  type PurchaseDraftDetailFieldId,
  type PurchaseDraftTemplate,
} from "./types";

const STORAGE_KEY = "school-health-desk.purchase-draft-templates.v1";
const MAX_TEMPLATES = 10;
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
    if (result.length === MAX_TEMPLATES) break;
  }
  return result;
};

export const loadPurchaseDraftTemplates = (): readonly PurchaseDraftTemplate[] => {
  try {
    return normalizePurchaseDraftTemplates(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch (error) {
    if (error instanceof SyntaxError) return [];
    throw error;
  }
};

export const savePurchaseDraftTemplates = (templates: readonly PurchaseDraftTemplate[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePurchaseDraftTemplates(templates)));
};
