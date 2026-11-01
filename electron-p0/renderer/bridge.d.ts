import type { P0Bridge, WorkBridge } from '../protocol';
declare global { interface Window { electronP0: P0Bridge; electronWork: WorkBridge } }
