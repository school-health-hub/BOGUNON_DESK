export type SurfaceState = 'Detached' | 'Preparing' | 'Attached' | 'Recovering'
  | 'CleanupPending' | 'CleanupUnknown' | 'Failed';
export type ContractState = Exclude<SurfaceState,'Attached'>;
export type HostState = 'Stopped' | 'Starting' | 'Running' | 'Stopping' | 'Exited';
export type CleanupState = 'NotNeeded' | 'Pending' | 'Verified' | 'Unknown';
export type FailureCode = 'InvalidSchema' | 'WrongSession' | 'WrongOwner' | 'WrongExplorer'
  | 'StaleSequence' | 'InvalidTransition' | 'Retired' | 'CleanupBlocked'
  | 'AlreadyRecorded' | 'NotOwned' | 'WrongIdentity' | 'ResourceUnresolved'
  | 'AdmissionOpen' | 'RuntimeMissing' | 'BrowserExitMissing' | 'AbnormalBrowserExit'
  | 'ReceiptInvalid' | 'RuntimeMismatch' | 'LeaseRequired' | 'AdmissionClosed';
export type Reason = 'None' | 'Cancelled' | 'NormalWindowRequested' | 'ExplorerChanged'
  | 'HostFailure' | 'UnexpectedHostExit' | 'CleanupIncomplete';
export type Snapshot = Readonly<{
  scope:'contract-only'; state:ContractState; host:HostState; cleanup:CleanupState;
  reason:Reason; admissionOpen:boolean; normalWindowRequested:boolean;
  nativeAttachmentVerified:false;
}>;
// ok means the request/observation was admitted, not that Native cleanup succeeded.
export type Result<T> = Readonly<{ok:true;value:T}> | Readonly<{ok:false;error:FailureCode}>;
export interface MainSurfacePort {
  readonly snapshot:Snapshot;
  request(request:unknown):Result<Snapshot>;
  explorerChanged(observation:unknown):Result<Snapshot>;
}
export interface HostObservationPort {observe(observation:unknown):Result<Snapshot>;}
export type NativeSurfaceBoundary=Readonly<{
  scope:'contract-only';main:MainSurfacePort;host:HostObservationPort;
}>;
