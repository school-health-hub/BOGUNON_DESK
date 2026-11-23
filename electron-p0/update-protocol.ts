export type UpdateState = Readonly<{
  phase:'unavailable'|'idle'|'checking'|'current'|'available'|'downloading'|'ready'|'failed';
  currentVersion:string;
  nextVersion?:string;
  notes?:string;
  progress?:number;
  message?:string;
}>;
