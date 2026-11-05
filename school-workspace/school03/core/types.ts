export type Status='TODO'|'IN_PROGRESS'|'DONE'|'CANCELLED';export type Priority='LOW'|'NORMAL'|'HIGH';
export interface Assignee{membership_id:string;epoch:number;member_code:string;active:boolean}
export interface Task{task_id:string;school_id:string;title:string;description:string;status:Status;priority:Priority;due_date:string|null;created_by_membership_id:string;created_by_epoch:number;created_at:string;updated_at:string;updated_by_membership_id:string;updated_by_epoch:number;version:number;archived_at:string|null;assignees:Assignee[]}
export interface Member{id:string;epoch:number;member_code:string;role:string}
export interface History{action:string;version:number;from_status:Status|null;to_status:Status;created_at:string;member_code:string}
export interface Board{tasks:Task[];members:Member[];self:{membership_id:string;epoch:number;role:string};limit:number}
export interface TaskState{phase:'locked'|'ready'|'offline'|'conflict'|'denied';school_id?:string;school_name?:string;board?:Board;detail?:Task;history?:History[];notice?:string;notice_kind?:'success'|'error';status:Status|'';sort:'DUE'|'PRIORITY';scope:'ALL'|'MINE'|'TODAY';archives:boolean}
export type TaskAction='select'|'refresh'|'detail'|'history'|'create'|'edit'|'assign'|'status'|'close';
export interface TaskBridge{command(action:TaskAction,input?:Record<string,unknown>):Promise<TaskState>}
export class TaskFault extends Error{constructor(readonly kind:'DENIED'|'CONFLICT'|'INPUT'|'NETWORK'|'EXPIRED'|'STALE'){super(kind);}}
export interface Contracts{
 ws_v1_list_tasks:{p_school_id:string;p_status:string|null;p_sort:string;p_scope:string;p_include_archived:boolean};
 ws_v1_get_task:{p_school_id:string;p_task_id:string};
 ws_v1_create_task:{p_school_id:string;p_title:string;p_description:string;p_priority:Priority;p_due_date:string|null;p_assignees:string[];p_request_id:string};
 ws_v1_edit_task:{p_school_id:string;p_task_id:string;p_title:string;p_description:string;p_priority:Priority;p_due_date:string|null;p_expected_version:number;p_request_id:string};
 ws_v1_assign_task:{p_school_id:string;p_task_id:string;p_assignees:string[];p_expected_version:number;p_request_id:string};
 ws_v1_change_assigned_task_status:{p_school_id:string;p_task_id:string;p_status:string;p_expected_version:number;p_request_id:string};
 ws_v1_close_task:{p_school_id:string;p_task_id:string;p_mode:string;p_expected_version:number;p_request_id:string};
 ws_v1_list_task_history:{p_school_id:string;p_task_id:string};
}
export const TASK_ACTIONS:readonly TaskAction[]=['select','refresh','detail','history','create','edit','assign','status','close'];
