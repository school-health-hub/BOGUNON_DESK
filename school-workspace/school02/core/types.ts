import type {WorkspaceViewState} from '../../integration/core/workspace.js';
import type {WorkspaceRole} from '../../auth/common/types.js';
export interface DirectorySchool {school_id:string;office_code:string;school_code:string;school_name:string;office_name:string;kind:string;space_state:string}
export interface JoinRequest{id:string;version:number;state:string;requested_role:string;requested_at:string}
export interface Membership{school_id:string;membership_id:string;member_code:string;role:WorkspaceRole|null;status:string;valid_until:string|null;approved_at:string|null;version:number;epoch:number;school_name:string;request:JoinRequest|null}
export interface Member{id:string;member_code:string;role:WorkspaceRole|null;status:string;version:number;approved_at:string|null;valid_until:string|null}
export interface PendingRequest extends JoinRequest{member_code:string}
export interface Transfer{id:string;version:number;mode:'add'|'transfer';state:string;expires_at:string;to_code:string;can_accept:boolean}
export interface SelfData{memberships:Membership[];space_requests:{school_id:string;state:string;school_name?:string;space_state?:string}[]}
export type AdminReauthStatus = 'unsupported' | 'required' | 'verified';
export interface SchoolState{adminReauth?:AdminReauthStatus;reauthNotice?:string;workspace:Readonly<WorkspaceViewState>;directory:DirectorySchool[];self:SelfData;selected?:string;admin?:{members:Member[];requests:PendingRequest[]};transfers:Transfer[];notice?:string}
export type Action='state'|'login'|'logout'|'search'|'select'|'refresh'|'join'|'space'|'withdraw'|'decide'|'role'|'membership'|'expiry'|'leave'|'propose'|'accept'|'reauth';
export interface SchoolBridge{command(action:Action,input?:Record<string,unknown>):Promise<SchoolState>}
