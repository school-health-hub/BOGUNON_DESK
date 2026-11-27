export type UpdateState = Readonly<{
  phase:'unavailable'|'idle'|'checking'|'current'|'available'|'downloading'|'ready'|'installing'|'failed';
  currentVersion:string;
  confirmationId?:string;
  nextVersion?:string;
  notes?:string;
  progress?:number;
  installSupported?:boolean;
  message?:string;
}>;
