import { InventoryError, type RpcInputs, type RpcName } from './contracts.js';
export const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new InventoryError('INVALID_RESPONSE');
  return v as Record<string, unknown>;
};
export function uuid(v: unknown): asserts v is string {
  if (typeof v !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) throw new InventoryError('INVALID_INPUT');
}
export function text(v: unknown, nullable = false, max = 500): void {
  if (v === null && nullable) return;
  if (typeof v !== 'string' || !v.trim() || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) throw new InventoryError('INVALID_INPUT');
}
export function integer(v: unknown, positive = false): void {
  if (typeof v !== 'string' || !/^(0|[1-9]\d{0,18})$/.test(v) || BigInt(v) > 9223372036854775807n || (positive && v === '0')) throw new InventoryError('INVALID_INPUT');
}
export function decimal(v: unknown, positive = false, scale = 6): void {
  if (typeof v !== 'string' || !new RegExp(`^(0|[1-9]\\d{0,11})(\\.\\d{1,${scale}})?$`).test(v) || (positive && !/[1-9]/.test(v))) throw new InventoryError('INVALID_INPUT');
}
export function date(v: unknown, nullable = false): void {
  if (v === null && nullable) return;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0,10) !== v) throw new InventoryError('INVALID_INPUT');
}
export function timestamp(v: unknown): void {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(v) || !Number.isFinite(Date.parse(v))) throw new InventoryError('INVALID_INPUT');
}
export function exact(v: Record<string, unknown>, keys: string[]): void {
  if (Object.keys(v).length !== keys.length || keys.some(k => !Object.prototype.hasOwnProperty.call(v,k))) throw new InventoryError('INVALID_INPUT');
}
const fields: Record<RpcName, string[]> = {
  inventory_use_stock: ['p_item_id','p_quantity','p_reason'],
  inventory_receive_stock: ['p_item_id','p_purchase_quantity','p_base_units_per_purchase_unit','p_received_at','p_expires_on','p_purchase_link_id','p_reason'],
  inventory_dispose_stock: ['p_item_id','p_lot_id','p_quantity','p_reason'],
  inventory_adjust_stock: ['p_item_id','p_lot_id','p_expected_quantity','p_counted_quantity','p_reason'],
  inventory_reverse_movement: ['p_original_movement_id','p_reason'],
  inventory_create_purchase_batch: ['p_batch_id','p_note','p_lines'],
  inventory_set_purchase_batch_status: ['p_batch_id','p_target_status','p_reason'],
  inventory_confirm_receipt: ['p_batch_id','p_receipt_id','p_received_at','p_reason','p_lines'],
};
export function validateRpc<N extends RpcName>(name: N, input: RpcInputs[N]): void {
  if (!Object.prototype.hasOwnProperty.call(fields, name)) throw new InventoryError('INVALID_INPUT');
  let v:Record<string,unknown>;
  try {v=record(input);} catch {throw new InventoryError('INVALID_INPUT');}
  exact(v,fields[name]);
  for (const [k,x] of Object.entries(v)) {
    if (k.endsWith('_id') && k !== 'p_purchase_link_id') uuid(x);
    if (k === 'p_reason') text(x);
    if (['p_quantity','p_purchase_quantity'].includes(k)) integer(x,true);
    if (['p_expected_quantity','p_counted_quantity'].includes(k)) integer(x);
    if (k === 'p_base_units_per_purchase_unit') decimal(x,true);
    if (k === 'p_received_at') timestamp(x);
    if (k === 'p_expires_on') date(x,true);
    if (k === 'p_purchase_link_id' && x !== null) throw new InventoryError('INVALID_INPUT');
    if (k === 'p_note') text(x,true);
    if (k === 'p_target_status' && !['APPROVED','ORDERED','AWAITING_RECEIPT','CANCELLED'].includes(String(x))) throw new InventoryError('INVALID_INPUT');
  }
  if ('p_lines' in v) {
    if (!Array.isArray(v.p_lines) || v.p_lines.length < 1 || v.p_lines.length > 100) throw new InventoryError('INVALID_INPUT');
    const seen = new Set();
    for (const line of v.p_lines) {
      const l=record(line);
      if (name === 'inventory_create_purchase_batch') {
        exact(l,['candidate_id','item_id','requested_purchase_quantity','base_unit','purchase_unit','base_units_per_purchase_unit','specification_snapshot','expected_unit_price','currency']);
        text(l.candidate_id,false,100); uuid(l.item_id); text(l.base_unit); text(l.purchase_unit);
        decimal(l.requested_purchase_quantity,true); decimal(l.base_units_per_purchase_unit,true); text(l.specification_snapshot,true);
        if (l.expected_unit_price === null) { if (l.currency !== null) throw new InventoryError('INVALID_INPUT'); }
        else { decimal(l.expected_unit_price,false,2); if (typeof l.currency !== 'string' || !/^[A-Z]{3}$/.test(l.currency)) throw new InventoryError('INVALID_INPUT'); }
      } else {
        exact(l,['line_id','received_purchase_quantity','expires_on']); uuid(l.line_id); decimal(l.received_purchase_quantity,true); date(l.expires_on,true);
      }
      const key = name === 'inventory_create_purchase_batch' ? String(l.candidate_id).trim() : l.line_id;
      if (seen.has(key)) throw new InventoryError('INVALID_INPUT'); seen.add(key);
    }
  }
}
/** Reject unsafe JSON numbers rather than claiming rounded bigint is authoritative. */
export function normalizeNumbers(value: unknown, key = ''): unknown {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) throw new InventoryError('INVALID_RESPONSE');
    return /quantity|stock|unit_price|units_per/.test(key) ? String(value) : value;
  }
  if (Array.isArray(value)) return value.map(v=>normalizeNumbers(v,key));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalizeNumbers(v,k)]));
  return value;
}

export function validateNewItem(input:unknown):void {
  const v=record(input);exact(v,['item_name','category','specification','base_unit','purchase_unit','base_units_per_purchase_unit','recommended_stock','minimum_stock','is_active']);
  text(v.item_name);text(v.category,true);text(v.specification,true);text(v.base_unit);text(v.purchase_unit);
  decimal(v.base_units_per_purchase_unit,true);integer(v.recommended_stock);integer(v.minimum_stock);
  if(typeof v.is_active!=='boolean')throw new InventoryError('INVALID_INPUT');
}
