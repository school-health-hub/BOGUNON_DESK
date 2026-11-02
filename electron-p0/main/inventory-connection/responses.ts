import { InventoryError, type RpcInputs, type RpcName, type RpcOutput } from './contracts.js';
import { integer, normalizeNumbers, record, timestamp, uuid } from './validation.js';
const operations: Record<RpcName,string> = {
  inventory_use_stock:'USE', inventory_receive_stock:'RECEIVE', inventory_dispose_stock:'DISPOSE', inventory_adjust_stock:'ADJUST',
  inventory_reverse_movement:'REVERSAL', inventory_create_purchase_batch:'PURCHASE_BATCH_CREATE', inventory_set_purchase_batch_status:'PURCHASE_BATCH_STATUS', inventory_confirm_receipt:'PURCHASE_RECEIPT_CONFIRM',
};
const statuses = ['DRAFT','APPROVED','ORDERED','AWAITING_RECEIPT','PARTIALLY_RECEIVED','RECEIVED','CANCELLED'];
function signedInteger(v:unknown):void {
  if(typeof v!=='string' || !/^-?(0|[1-9]\d*)$/.test(v) || BigInt(v)<-9223372036854775808n || BigInt(v)>9223372036854775807n) throw new InventoryError('INVALID_RESPONSE');
}
/** A malformed acknowledgement must never become a successful write. */
export function decodeRpc<N extends RpcName>(name:N, value:unknown, school:string, request:string, input:RpcInputs[N]):RpcOutput<N> {
  try {
    const r=record(normalizeNumbers(value));
    if(r.school_id!==school || r.request_uuid!==request || r.operation!==operations[name] || typeof r.replayed!=='boolean') throw new InventoryError('INVALID_RESPONSE');
    timestamp(r.processed_at);
    const args=record(input);
    if(name==='inventory_create_purchase_batch' || name==='inventory_set_purchase_batch_status' || name==='inventory_confirm_receipt') {
      uuid(r.batch_id); if(r.batch_id!==args.p_batch_id || !statuses.includes(String(r.status))) throw new InventoryError('INVALID_RESPONSE');
      if(name==='inventory_create_purchase_batch' && (r.status!=='DRAFT' || r.line_count!==(args.p_lines as unknown[]).length)) throw new InventoryError('INVALID_RESPONSE');
      if(name==='inventory_set_purchase_batch_status' && r.status!==args.p_target_status) throw new InventoryError('INVALID_RESPONSE');
      if(name==='inventory_confirm_receipt') {
        uuid(r.receipt_id); uuid(r.item_id);
        if(r.receipt_id!==args.p_receipt_id || !['PARTIALLY_RECEIVED','RECEIVED'].includes(String(r.status)) || !Array.isArray(r.receipt_lines) || !Array.isArray(r.remaining_by_line)) throw new InventoryError('INVALID_RESPONSE');
        const expected=new Set((args.p_lines as {line_id:string}[]).map(l=>l.line_id));
        if(r.receipt_lines.length!==expected.size) throw new InventoryError('INVALID_RESPONSE');
        for(const value of r.receipt_lines) {
          const line=record(value); for(const k of ['line_id','item_id','lot_id','movement_id']) uuid(line[k]); integer(line.received_base_quantity,true);
          if(!expected.delete(String(line.line_id))) throw new InventoryError('INVALID_RESPONSE');
        }
        const remaining=new Set<string>();
        for(const value of r.remaining_by_line) {const line=record(value);uuid(line.line_id);integer(line.remaining_base_quantity);if(remaining.has(line.line_id))throw new InventoryError('INVALID_RESPONSE');remaining.add(line.line_id);}
      }
    } else {
      uuid(r.item_id); if(args.p_item_id && r.item_id!==args.p_item_id) throw new InventoryError('INVALID_RESPONSE');
      signedInteger(r.quantity_delta); integer(r.item_total_quantity); integer(r.item_available_quantity);
      if(BigInt(String(r.item_available_quantity))>BigInt(String(r.item_total_quantity)) || !['applied','replayed'].includes(String(r.status)) || r.replayed!==(r.status==='replayed') || !Array.isArray(r.movements) || typeof r.reactivation_required!=='boolean') throw new InventoryError('INVALID_RESPONSE');
      for(const value of r.movements) {const m=record(value);uuid(m.movement_id);uuid(m.lot_id);signedInteger(m.quantity_delta);integer(m.quantity_before);integer(m.quantity_after);if(BigInt(String(m.quantity_before))+BigInt(String(m.quantity_delta))!==BigInt(String(m.quantity_after)))throw new InventoryError('INVALID_RESPONSE');}
    }
    return r as unknown as RpcOutput<N>;
  } catch { throw new InventoryError('INVALID_RESPONSE',undefined,true); }
}
