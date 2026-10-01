import { createPurchaseClipboard } from "./purchaseClipboard";
import { selectedPurchaseTotal } from "./purchaseDomain";
import {
  purchaseDraftDetailFieldIds,
  type PurchaseDraft,
  type PurchaseDraftDetailFieldId,
  type PurchaseDraftTemplate,
  type PurchaseItem,
  type PurchaseOutputColumnId,
} from "./types";

export const defaultPurchaseDraftTemplate: PurchaseDraftTemplate = {
  id: "default",
  name: "기본 템플릿",
  titlePattern: "{{title}}",
  introPattern: "{{purpose}}",
  detailFieldOrder: purchaseDraftDetailFieldIds,
  attachmentPhrase: "붙임  품목내역 1부.  끝.",
  includeAttachment: true,
};

export const suggestPurchaseDraftValue = (
  items: readonly PurchaseItem[],
  field: "vendor" | "budgetItem",
): string => {
  const values = items.filter((item) => item.selected).map((item) => item[field].trim());
  if (values.length === 0 || values.every((value) => value === "")) return "";
  const first = values[0] ?? "";
  return first !== "" && values.every((value) => value === first)
    ? first
    : field === "vendor" ? "여러 구매처" : "여러 예산항목";
};

export const createPurchaseDraft = (items: readonly PurchaseItem[]): PurchaseDraft => ({
  title: "물품 구매 품의",
  purpose: "업무에 필요한 물품을 다음과 같이 구매하고자 합니다.",
  purchaseSummary: "물품 구매",
  vendor: suggestPurchaseDraftValue(items, "vendor"),
  budgetItem: suggestPurchaseDraftValue(items, "budgetItem"),
  note: "",
  includeAttachment: true,
  templateId: defaultPurchaseDraftTemplate.id,
  titlePattern: defaultPurchaseDraftTemplate.titlePattern,
  introPattern: defaultPurchaseDraftTemplate.introPattern,
  detailFieldOrder: defaultPurchaseDraftTemplate.detailFieldOrder,
  attachmentPhrase: defaultPurchaseDraftTemplate.attachmentPhrase,
});

const detailLabels: Readonly<Record<PurchaseDraftDetailFieldId, string>> = {
  summary: "구매내용",
  amount: "구매금액",
  vendor: "구매처",
  budgetItem: "예산항목",
};

const detailValues = (
  draft: PurchaseDraft,
  amount: number,
): Readonly<Record<PurchaseDraftDetailFieldId, string>> => ({
  summary: draft.purchaseSummary.trim(),
  amount: `금${Math.round(amount).toLocaleString("ko-KR")}원`,
  vendor: draft.vendor.trim(),
  budgetItem: draft.budgetItem.trim(),
});

const koreanMarkers = ["가", "나", "다", "라", "마", "바", "사", "아"] as const;

export const createPurchaseDraftText = (
  draft: PurchaseDraft,
  items: readonly PurchaseItem[],
  template: PurchaseDraftTemplate = defaultPurchaseDraftTemplate,
): string => {
  const values = detailValues(draft, selectedPurchaseTotal(items));
  const details = template.detailFieldOrder
    .map((field) => ({ field, value: values[field] }))
    .filter(({ value }) => value !== "")
    .map(({ field, value }, index) => `${koreanMarkers[index] ?? `${index + 1}`}. ${detailLabels[field]}: ${value}`);
  const title = template.titlePattern.split("{{title}}").join(draft.title.trim()).trim();
  const intro = template.introPattern.split("{{purpose}}").join(draft.purpose.trim()).trim();
  const sections = [title, intro, details.join("\n"), draft.note.trim()]
    .filter((value) => value !== "");
  if (draft.includeAttachment && template.attachmentPhrase.trim() !== "") {
    sections.push(template.attachmentPhrase.trim());
  }
  return sections.join("\n\n");
};

const escapeHtml = (value: string): string => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

export const createPurchaseDraftClipboard = (
  draft: PurchaseDraft,
  items: readonly PurchaseItem[],
  columns: readonly PurchaseOutputColumnId[],
  template: PurchaseDraftTemplate = defaultPurchaseDraftTemplate,
  includeTable = false,
): { readonly text: string; readonly html: string } => {
  const draftText = createPurchaseDraftText(draft, items, template);
  const draftHtml = draftText.split("\n\n").map((section) => `<p>${escapeHtml(section).replace(/\n/g, "<br>")}</p>`).join("");
  if (!includeTable) return { text: draftText, html: draftHtml };
  const table = createPurchaseClipboard(items, columns);
  return { text: `${draftText}\n\n${table.text}`, html: `${draftHtml}${table.html}` };
};
