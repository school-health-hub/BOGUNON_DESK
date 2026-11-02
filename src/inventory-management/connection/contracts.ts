/** Wire DTOs follow the committed Inventory SQL, independently of Electron/UI. */
export type UUID = string;
export type Decimal = string;
export type Integer = string; // Never round PostgreSQL bigint through JS number.
export type Role = 'teacher_admin' | 'instructor';
export type BatchStatus = 'DRAFT' | 'APPROVED' | 'ORDERED' | 'AWAITING_RECEIPT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
export type AuthState = { status: 'signed_out' | 'signing_in' | 'expired' | 'disposed' } | { status: 'authenticated'; userId: UUID; schoolId: UUID | null };
export type ErrorCode = 'ENVIRONMENT_BLOCKED' | 'INVALID_INPUT' | 'UNAUTHENTICATED' | 'PERMISSION_DENIED' | 'NOT_FOUND' | 'CONFLICT' | 'SERVER_REJECTED' | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'STALE_CONTEXT' | 'REQUEST_IN_FLIGHT' | 'IDEMPOTENCY_CONFLICT' | 'DISPOSED';
export class InventoryError extends Error {
  constructor(readonly code: ErrorCode, readonly serverCode?: string, readonly outcomeUnknown = false) {
    super(code); this.name = 'InventoryError';
  }
}
export interface Item {
  item_id: UUID; school_id: UUID; item_name: string; category: string | null; specification: string | null;
  base_unit: string; purchase_unit: string; base_units_per_purchase_unit: Decimal;
  recommended_stock: Integer; minimum_stock: Integer; is_active: boolean;
}
export interface Lot {
  lot_id: UUID; school_id: UUID; item_id: UUID; received_at: string; expires_on: string | null;
  initial_quantity: Integer; remaining_quantity: Integer; status: 'available' | 'quarantined' | 'unavailable' | 'depleted';
}
export interface Movement {
  movement_id: UUID; school_id: UUID; item_id: UUID; lot_id: UUID; actor_user_id: UUID;
  movement_type: 'INITIAL_BALANCE' | 'RECEIVE' | 'USE' | 'DISPOSE' | 'ADJUST' | 'REVERSAL';
  quantity_delta: Integer; quantity_before: Integer; quantity_after: Integer; reason: string; created_at: string;
}
export interface PurchaseBatch { batch_id: UUID; school_id: UUID; status: BatchStatus; note: string | null }
export interface PurchaseLine {
  line_id: UUID; school_id: UUID; batch_id: UUID; item_id: UUID; candidate_id: string;
  requested_purchase_quantity: Decimal; requested_base_quantity: Integer; received_base_quantity: Integer;
  base_unit: string; purchase_unit: string; base_units_per_purchase_unit: Decimal;
  specification_snapshot: string | null; expected_unit_price: Decimal | null; currency: string | null;
}
export interface Receipt { receipt_id: UUID; school_id: UUID; batch_id: UUID; received_at: string; reason: string }
export interface ReceiptLine { receipt_line_id: UUID; school_id: UUID; batch_id: UUID; receipt_id: UUID; line_id: UUID; received_base_quantity: Integer; received_purchase_quantity: Decimal }
export interface StockTotals { totalQuantity: Integer; availableQuantity: Integer; referenceDate: string; source: 'rls-visible-lots' }
export interface ItemDetail { item: Item; lots: Lot[]; totals: StockTotals }
export interface PurchaseProgress { batch: PurchaseBatch; lines: PurchaseLine[]; receipts: Receipt[]; receiptLines: ReceiptLine[] }
export interface NewItem {
  item_name: string; category: string | null; specification: string | null; base_unit: string; purchase_unit: string;
  base_units_per_purchase_unit: Decimal; recommended_stock: Integer; minimum_stock: Integer; is_active: boolean;
}
export interface PurchaseLineInput {
  candidate_id: string; item_id: UUID; requested_purchase_quantity: Decimal; base_unit: string; purchase_unit: string;
  base_units_per_purchase_unit: Decimal; specification_snapshot: string | null; expected_unit_price: Decimal | null; currency: string | null;
}
export interface ReceiptLineInput { line_id: UUID; received_purchase_quantity: Decimal; expires_on: string | null }
export interface RpcInputs {
  inventory_use_stock: { p_item_id: UUID; p_quantity: Integer; p_reason: string };
  inventory_receive_stock: { p_item_id: UUID; p_purchase_quantity: Integer; p_base_units_per_purchase_unit: Decimal; p_received_at: string; p_expires_on: string | null; p_purchase_link_id: null; p_reason: string };
  inventory_dispose_stock: { p_item_id: UUID; p_lot_id: UUID; p_quantity: Integer; p_reason: string };
  inventory_adjust_stock: { p_item_id: UUID; p_lot_id: UUID; p_expected_quantity: Integer; p_counted_quantity: Integer; p_reason: string };
  inventory_reverse_movement: { p_original_movement_id: UUID; p_reason: string };
  inventory_create_purchase_batch: { p_batch_id: UUID; p_note: string | null; p_lines: PurchaseLineInput[] };
  inventory_set_purchase_batch_status: { p_batch_id: UUID; p_target_status: 'APPROVED' | 'ORDERED' | 'AWAITING_RECEIPT' | 'CANCELLED'; p_reason: string };
  inventory_confirm_receipt: { p_batch_id: UUID; p_receipt_id: UUID; p_received_at: string; p_reason: string; p_lines: ReceiptLineInput[] };
}
export type RpcName = keyof RpcInputs;
export interface StockResponse {
  request_uuid: UUID; operation: 'USE' | 'RECEIVE' | 'DISPOSE' | 'ADJUST' | 'REVERSAL'; school_id: UUID; item_id: UUID;
  quantity_delta: Integer; item_total_quantity: Integer; item_available_quantity: Integer;
  movements: { movement_id: UUID; lot_id: UUID; movement_type: Movement['movement_type']; quantity_delta: Integer; quantity_before: Integer; quantity_after: Integer }[];
  processed_at: string; replayed: boolean; status: 'applied' | 'replayed'; reactivation_required: boolean;
}
export interface BatchResponse { request_uuid: UUID; operation: string; school_id: UUID; batch_id: UUID; status: BatchStatus; processed_at: string; replayed: boolean }
export interface CreateBatchResponse extends BatchResponse { line_count: number }
export interface ReceiptResponse extends BatchResponse {
  receipt_id: UUID; item_id: UUID;
  receipt_lines: { line_id: UUID; item_id: UUID; lot_id: UUID; movement_id: UUID; received_base_quantity: Integer }[];
  remaining_by_line: { line_id: UUID; remaining_base_quantity: Integer }[];
}
export type RpcOutput<N extends RpcName> = N extends 'inventory_confirm_receipt' ? ReceiptResponse : N extends 'inventory_create_purchase_batch' ? CreateBatchResponse : N extends 'inventory_set_purchase_batch_status' ? BatchResponse : StockResponse;
export interface PreparedMutation<N extends RpcName> {
  readonly requestUuid: UUID;
  /** All retries use the captured UUID, school, actor and immutable payload. */
  execute(): Promise<{ persisted: true; data: RpcOutput<N>; refreshRequired: true }>;
}
export interface InventoryLocalConnection {
  readonly mode: 'local-qa';
  authState(): AuthState;
  subscribe(listener: (state: AuthState) => void): () => void;
  /** Invalidates caller-owned views on auth/school changes and successful mutations. */
  onInvalidate(listener: () => void): () => void;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  selectSchool(schoolId: UUID): Promise<void>;
  listItems(): Promise<Item[]>;
  itemDetail(itemId: UUID): Promise<ItemDetail>;
  movements(itemId?: UUID): Promise<Movement[]>;
  purchaseBatches(): Promise<PurchaseBatch[]>;
  purchaseProgress(batchId: UUID): Promise<PurchaseProgress>;
  prepare<N extends RpcName>(name: N, input: RpcInputs[N], requestUuid?: UUID): PreparedMutation<N>;
  registerItem(input: NewItem): Promise<{ persisted: true; item: Item; refreshRequired: true }>;
  dispose(): void;
}
