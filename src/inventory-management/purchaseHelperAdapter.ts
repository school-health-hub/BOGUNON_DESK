import type { PurchaseItem, PurchaseIssue } from "../purchase/types";
import { fractionToIntegerString, fractionToNonnegativeSafeInteger, fractionToPositiveSafeNumber, multiplyFractions, parseNonnegativeDecimal } from "./purchaseHelperDecimal";
import type { AdapterIssue, ChangedPurchaseLine, InventoryPurchaseBatchSnapshot, InventoryPurchaseLineSnapshot, MatchedPurchaseLine, MissingPurchaseLine, ProjectionResult, PurchaseHelperAdapterSession, PurchaseHelperLineage, ReconciliationInput, ReconciliationResult } from "./purchaseHelperAdapterTypes";

const formulaTextPattern = /^\s*[=+\-@]/;
const controlTextPattern = /[\u0000-\u001f\u007f]/;
const maxTextLength = 500;
const isSafeText = (value: string): boolean => value.length <= maxTextLength && !formulaTextPattern.test(value) && !controlTextPattern.test(value);
const hasSafeHelperText = (item: PurchaseItem): boolean => [item.name, item.specification, item.vendor, item.note, item.budgetItem, item.sourceName ?? ""].every(isSafeText);
const issue = (code: AdapterIssue["code"], field: string, lineId: string | null): AdapterIssue => ({ code, field, lineId });

const helperIssues = (name: string, quantity: number, unitPrice: number | null): readonly PurchaseIssue[] => {
  const issues: PurchaseIssue[] = [];
  if (name.trim() === "") issues.push("missingName");
  if (!Number.isFinite(quantity) || quantity <= 0) issues.push("invalidQuantity");
  if (unitPrice === null || !Number.isFinite(unitPrice) || unitPrice < 0) issues.push("invalidUnitPrice");
  return issues;
};

const projectLine = (schoolId: string, batchId: string, line: InventoryPurchaseLineSnapshot, index: number): { readonly item: PurchaseItem; readonly lineage: PurchaseHelperLineage } | { readonly issues: readonly AdapterIssue[] } => {
  const issues: AdapterIssue[] = [];
  if (typeof line.schoolId !== "string" || line.schoolId.trim() === "" || line.schoolId !== schoolId) issues.push(issue("CROSS_SCHOOL", "schoolId", line.lineId));
  const texts = [["itemName", line.itemName], ["specification", line.specification], ["baseUnit", line.baseUnit], ["purchaseUnit", line.purchaseUnit]] as const;
  for (const [field, value] of texts) if (!isSafeText(value) || value.trim() === "") issues.push(issue("INVALID_TEXT", field, line.lineId));
  const quantity = parseNonnegativeDecimal(line.requestedPurchaseQuantity);
  const conversion = parseNonnegativeDecimal(line.baseUnitsPerPurchaseUnit);
  if (quantity.kind === "invalid") issues.push(issue("INVALID_DECIMAL", "requestedPurchaseQuantity", line.lineId));
  if (conversion.kind === "invalid") issues.push(issue("INVALID_DECIMAL", "baseUnitsPerPurchaseUnit", line.lineId));
  const price = line.expectedUnitPrice === null ? null : parseNonnegativeDecimal(line.expectedUnitPrice);
  if (price?.kind === "invalid") issues.push(issue("INVALID_PRICE", "expectedUnitPrice", line.lineId));
  if (issues.length > 0 || quantity.kind === "invalid" || conversion.kind === "invalid" || price?.kind === "invalid") return { issues };
  const requestedBaseQuantity = fractionToIntegerString(multiplyFractions(quantity.value, conversion.value));
  if (requestedBaseQuantity === null || requestedBaseQuantity === "0") issues.push(issue("NON_INTEGER_BASE_QUANTITY", "requestedPurchaseQuantity", line.lineId));
  const helperQuantity = fractionToPositiveSafeNumber(quantity.value);
  if (helperQuantity === null) issues.push(issue("LOSSY_HELPER_NUMBER", "requestedPurchaseQuantity", line.lineId));
  const helperPrice = price === null ? null : fractionToNonnegativeSafeInteger(price.value);
  if (price !== null && helperPrice === null) issues.push(issue("INVALID_PRICE", "expectedUnitPrice", line.lineId));
  if (issues.length > 0 || requestedBaseQuantity === null || helperQuantity === null) return { issues };
  const helperRowId = `inventory-adapter-row-${index + 1}`;
  return {
    item: { id: helperRowId, selected: true, name: line.itemName, specification: line.specification, quantity: helperQuantity, unitPrice: helperPrice, importedAmount: null, vendor: "", note: "", budgetItem: "", sourceName: "Inventory", issues: helperIssues(line.itemName, helperQuantity, helperPrice), amountMismatchReviewed: false },
    lineage: { helperRowId, schoolId, batchId, lineId: line.lineId, itemId: line.itemId, candidateId: line.candidateId, baseUnit: line.baseUnit, purchaseUnit: line.purchaseUnit, baseUnitsPerPurchaseUnit: line.baseUnitsPerPurchaseUnit, requestedPurchaseQuantity: line.requestedPurchaseQuantity, requestedBaseQuantity, expectedUnitPrice: line.expectedUnitPrice, originalName: line.itemName, originalSpecification: line.specification },
  };
};

export const createPurchaseHelperSession = (snapshot: InventoryPurchaseBatchSnapshot): ProjectionResult => {
  const issues: AdapterIssue[] = [];
  const lineIds = new Set<string>();
  const candidateIds = new Set<string>();
  const items: PurchaseItem[] = [];
  const lineage: PurchaseHelperLineage[] = [];
  snapshot.lines.forEach((line, index) => {
    if (lineIds.has(line.lineId) || candidateIds.has(line.candidateId)) issues.push(issue("DUPLICATE_LINE", "lineId", line.lineId));
    lineIds.add(line.lineId);
    candidateIds.add(line.candidateId);
    const result = projectLine(snapshot.schoolId, snapshot.batchId, line, index);
    if ("issues" in result) issues.push(...result.issues);
    else { items.push(result.item); lineage.push(result.lineage); }
  });
  if (issues.length > 0) return { kind: "rejected", issues };
  const session: PurchaseHelperAdapterSession = {
    sessionId: `${snapshot.batchId}:adapter-v1`, schoolId: snapshot.schoolId, batchId: snapshot.batchId, serverSnapshot: snapshot,
    helperItems: items, lineage, stockEffect: "NONE", receiptCommand: null,
    recovery: { serverBatch: "RECOVERABLE", unsavedHelperEdits: "NOT_RECOVERABLE", downloadedFiles: "EXTERNAL_ONLY", confirmedReceipts: "SERVER_RECORDED" },
  };
  return { kind: "ready", session };
};

export const reconcilePurchaseHelperSession = (input: ReconciliationInput): ReconciliationResult => {
  const issues: AdapterIssue[] = [];
  const matched: MatchedPurchaseLine[] = [];
  const changed: ChangedPurchaseLine[] = [];
  const missing: MissingPurchaseLine[] = [];
  const added: { readonly helperRowId: string; readonly reason: "UNKNOWN_HELPER_ROW" }[] = [];
  if (input.activeSchoolId !== input.session.schoolId) issues.push(issue("CROSS_SCHOOL", "activeSchoolId", null));
  const byRow = new Map(input.session.lineage.map((entry) => [entry.helperRowId, entry]));
  const seen = new Set<string>();
  for (const item of input.helperItems) {
    if (seen.has(item.id)) issues.push(issue("DUPLICATE_HELPER_ROW", "id", byRow.get(item.id)?.lineId ?? null));
    seen.add(item.id);
    const lineage = byRow.get(item.id);
    if (!hasSafeHelperText(item)) issues.push(issue("INVALID_TEXT", "helperText", lineage?.lineId ?? null));
    if (lineage === undefined) { added.push({ helperRowId: item.id, reason: "UNKNOWN_HELPER_ROW" }); continue; }
    if (!item.selected) { missing.push({ lineId: lineage.lineId, reason: "ROW_DESELECTED" }); continue; }
    if (item.quantity === null || !Number.isFinite(item.quantity) || item.quantity <= 0) issues.push(issue("AMBIGUOUS_QUANTITY", "quantity", lineage.lineId));
    if (item.unitPrice === null || !Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0) issues.push(issue("INVALID_PRICE", "unitPrice", lineage.lineId));
    const identityChanged = item.name !== lineage.originalName || item.specification !== lineage.originalSpecification;
    if (identityChanged) issues.push(issue("AMBIGUOUS_IDENTITY_EDIT", "nameOrSpecification", lineage.lineId));
    const originalQuantity = parseNonnegativeDecimal(lineage.requestedPurchaseQuantity);
    const originalPrice = lineage.expectedUnitPrice === null ? null : parseNonnegativeDecimal(lineage.expectedUnitPrice);
    const expectedHelperQuantity = originalQuantity.kind === "valid" ? fractionToPositiveSafeNumber(originalQuantity.value) : null;
    const expectedHelperPrice = originalPrice?.kind === "valid" ? fractionToNonnegativeSafeInteger(originalPrice.value) : null;
    const quantityChanged = item.quantity !== expectedHelperQuantity;
    const priceChanged = item.unitPrice !== expectedHelperPrice;
    const editedQuantity = item.quantity === null ? null : parseNonnegativeDecimal(String(item.quantity));
    const conversion = parseNonnegativeDecimal(lineage.baseUnitsPerPurchaseUnit);
    const baseQuantity = editedQuantity?.kind === "valid" && conversion.kind === "valid" ? fractionToIntegerString(multiplyFractions(editedQuantity.value, conversion.value)) : null;
    if (baseQuantity === null || baseQuantity === "0") issues.push(issue("AMBIGUOUS_QUANTITY", "quantity", lineage.lineId));
    const matchedLine = { helperRowId: item.id, lineId: lineage.lineId, itemId: lineage.itemId };
    matched.push(matchedLine);
    if (quantityChanged || priceChanged || identityChanged) changed.push({ ...matchedLine, requestedPurchaseQuantity: item.quantity === null ? lineage.requestedPurchaseQuantity : String(item.quantity), expectedUnitPrice: item.unitPrice === null ? null : String(item.unitPrice), name: item.name, specification: item.specification });
  }
  for (const lineage of input.session.lineage) if (!seen.has(lineage.helperRowId)) missing.push({ lineId: lineage.lineId, reason: "ROW_REMOVED" });
  const rejected = issues.some((entry) => entry.code === "CROSS_SCHOOL" || entry.code === "DUPLICATE_HELPER_ROW" || (entry.code === "INVALID_TEXT" && entry.lineId !== null));
  const kind = rejected ? "rejected" : issues.length > 0 || changed.length > 0 || missing.length > 0 || added.length > 0 ? "review_required" : "ready";
  return { kind, matched, changed, missing, added, issues, stockEffect: "NONE", receiptCommand: null };
};
