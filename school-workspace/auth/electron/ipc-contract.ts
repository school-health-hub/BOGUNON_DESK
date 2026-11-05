import type { WorkspaceAuthErrorCode, WorkspaceAuthStatus } from '../common/types.js';
export const AUTH_CHANNELS = Object.freeze({ status: 'ws:auth:status', begin: 'ws:auth:begin', restore: 'ws:auth:restore', logout: 'ws:auth:logout' });
export type AuthReply = { ok: true; status: WorkspaceAuthStatus } | { ok: false; error: WorkspaceAuthErrorCode };
export interface AuthPreloadBridge { status(): Promise<AuthReply>; begin(): Promise<AuthReply>; restore(): Promise<AuthReply>; logout(): Promise<AuthReply> }
