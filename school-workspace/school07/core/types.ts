export type Action='select'|'refresh'|'detail'|'create'|'edit'|'location'|'receive'|'use'|'adjust'|'dispose'|'state';
export interface Item{item_id:string;school_id:string;item_name:string;category:string;specification:string;unit:string;minimum_quantity:number;storage_location_id:string|null;location_name:string|null;active:boolean;version:number;total_quantity:number;available_quantity:number;soon_quantity:number;expired_quantity:number;unusable_quantity:number;is_low:boolean}
export interface Lot{lot_id:string;item_id:string;expiry_date:string|null;received_date:string;quantity:number;version:number;state:'AVAILABLE'|'UNUSABLE';expiry_status:'NORMAL'|'SOON'|'EXPIRED'|'NONE'}
export interface Movement{movement_id:string;type:string;delta:number;quantity_after:number;member_code:string;created_at:string;reason:string}
export interface Context{role:string;manage:boolean;receive:boolean;use:boolean;adjust:boolean;dispose:boolean;today:string;soon_days:number}
export interface State{phase:'locked'|'ready'|'offline'|'denied'|'conflict';school_id?:string;school_name?:string;context?:Context;items:Item[];locations:{location_id:string;name:string;version:number;active:boolean}[];lots:Lot[];movements:Movement[];item?:Item;notice?:string;success?:boolean}
export interface Bridge{command(action:Action,input?:Record<string,unknown>):Promise<State>}
