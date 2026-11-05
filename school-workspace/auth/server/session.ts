import { WorkspaceAuthError, userSummary } from '../common/types.js';
import type { SecretSession } from './ports.js';
export function validateSession(value: unknown): SecretSession {
  const v = value as Partial<SecretSession> | null;
  if (!v || typeof v !== 'object' || Object.keys(v).sort().join(',') !== 'accessToken,expiresAt,refreshToken,userId'
    || typeof v.userId !== 'string' || typeof v.accessToken !== 'string' || !v.accessToken || v.accessToken.length > 65_536
    || typeof v.refreshToken !== 'string' || !v.refreshToken || v.refreshToken.length > 65_536
    || typeof v.expiresAt !== 'number' || !Number.isFinite(v.expiresAt) || v.expiresAt <= 0)
    throw new WorkspaceAuthError('SESSION_CORRUPT');
  try { userSummary(v.userId); } catch { throw new WorkspaceAuthError('SESSION_CORRUPT'); }
  return { userId: v.userId, accessToken: v.accessToken, refreshToken: v.refreshToken, expiresAt: v.expiresAt };
}
