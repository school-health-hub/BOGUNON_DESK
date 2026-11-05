import type{Task}from'../../school03/core/types.js';
export interface Member{id:string;epoch:number;member_code:string;role:string}
export interface Context{membership_id:string;epoch:number;role:string;can_create_handover:boolean;members:Member[]}
export interface SharedEvent{event_id:string;school_id:string;title:string;description:string;start_at:string;end_at:string;all_day:boolean;status:'SCHEDULED'|'CANCELLED';version:number;created_at:string;updated_at:string;created_by:string;created_by_epoch:number;updated_by:string;updated_by_epoch:number}
export interface Target{membership_id:string;epoch:number;member_code:string;role_at_publish:string;active:boolean;acknowledged:boolean}
export interface Note{handover_id:string;school_id:string;version:number;content_revision:number;title:string;body:string;created_by:string;created_by_epoch:number;author_code:string;created_at:string;updated_at:string;status:'OPEN'|'COMPLETED';completed_at:string|null;ack_required:boolean;acknowledged:boolean;can_edit:boolean;can_complete:boolean;targets:Target[];target_roles:string[];explicit_targets:string[]}
export interface Revision{version:number;title:string;body:string;member_code:string;created_at:string}
export interface EventHistory{version:number;action:string;start_at:string;end_at:string;all_day:boolean;status:string;created_at:string;member_code:string}
export interface ActivityState{phase:'locked'|'ready'|'offline'|'denied'|'conflict';school_id?:string;school_name?:string;month:string;context?:Context;events:SharedEvent[];notes:Note[];tasks:Task[];event?:SharedEvent;note?:Note;event_history?:EventHistory[];note_history?:Revision[];notice?:string;notice_kind?:'success'|'error'}
export type Action='select'|'refresh'|'event_get'|'event_save'|'event_cancel'|'event_history'|'note_get'|'note_create'|'note_edit'|'note_ack'|'note_complete'|'note_history';
export const ACTIONS:readonly Action[]=['select','refresh','event_get','event_save','event_cancel','event_history','note_get','note_create','note_edit','note_ack','note_complete','note_history'];
export interface Bridge{command(action:Action,input?:Record<string,unknown>):Promise<ActivityState>}
