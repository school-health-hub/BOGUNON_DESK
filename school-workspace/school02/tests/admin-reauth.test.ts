import { expect, it, vi } from 'vitest';
import { WorkspaceAuthError, type WorkspaceAuthStatus, type WorkspaceRole } from '../../auth/common/types.js';
import { WorkspaceCoordinator } from '../../integration/core/workspace.js';
import { deferred } from '../../auth/tests/fixtures.js';
import { SchoolController, type SchoolPort } from '../core/controller.js';

const school = '10000000-0000-0000-0000-000000000001';
const otherSchool = '10000000-0000-0000-0000-000000000002';
const proposal = { id: 'target', mode: 'transfer' };

async function fixture(reauthenticate?: SchoolPort['reauthenticate'], role: WorkspaceRole = 'SCHOOL_ADMIN') {
 let status: WorkspaceAuthStatus = { kind: 'authenticated', session: { user: { id: 'actor' }, expiresAt: Number.MAX_SAFE_INTEGER } };
 const workspace = new WorkspaceCoordinator({
  authStatus: async () => status,
  login: async () => {},
  logout: async () => { status = { kind: 'signed_out' }; },
  invalidate: () => {},
  bootstrap: async () => ({ actor_id: 'actor' }),
  membership: async () => ({ status: 'active' }),
  context: async schoolId => ({ schoolId, role, memberCode: 'admin', epoch: 1, version: 1, permissions: [], evidence: 'MOCK' }),
  rpc: async () => { throw Error('unexpected coordinator RPC'); },
 });
 const transfer = vi.fn<(name: string, args: object) => Promise<unknown>>(async () => ({}));
 const controller = new SchoolController({ workspace, reauthenticate, call: async (name, args) => {
  if (name === 'ws_s02_self') return { memberships: [], space_requests: [] };
  if (name === 'ws_s02_admin') return { requests: [], members: [] };
  if (name === 'ws_s02_transfers') return [];
  return transfer(name, args);
 }});
 await controller.command('select', { school });
 return { controller, transfer, setStatus: (next: WorkspaceAuthStatus) => { status = next; } };
}

it('keeps unsupported reauthentication and transfer RPCs closed', async () => {
 const { controller, transfer } = await fixture();
 expect((await controller.command('reauth')).adminReauth).toBe('unsupported');
 await controller.command('propose', proposal);
 await controller.command('accept', { id: 'request', version: 1 });
 expect(transfer).not.toHaveBeenCalled();
});

it.each([
 ['cancelled', '취소'],
 ['failed', '실패'],
] as const)('does not send a transfer after reauthentication is %s', async (result, message) => {
 const { controller, transfer } = await fixture(async () => result);
 expect((await controller.command('reauth')).reauthNotice).toContain(message);
 await controller.command('propose', proposal);
 expect(transfer).not.toHaveBeenCalled();
});

it('blocks a transfer when reauthentication reports an expired session', async () => {
 const { controller, transfer } = await fixture(async () => { throw new WorkspaceAuthError('UNAUTHENTICATED'); });
 expect((await controller.command('reauth')).workspace.phase).toBe('expired_session');
 await controller.command('propose', proposal);
 expect(transfer).not.toHaveBeenCalled();
});

it.each(['select', 'login', 'logout'] as const)('drops in-flight reauthentication on %s', async action => {
 const entered = deferred<void>();
 const result = deferred<'verified'>();
 const { controller, transfer } = await fixture(() => {
  entered.resolve();
  return result.promise;
 });
 const attempt = controller.command('reauth');
 await entered.promise;
 await controller.command(action, action === 'select' ? { school: otherSchool } : {});
 result.resolve('verified');
 await attempt;
 if (action === 'login') await controller.command('select', { school });
 await controller.command('propose', proposal);
 expect(transfer).not.toHaveBeenCalled();
});

it('drops verified reauthentication after the authenticated account changes', async () => {
 const { controller, transfer, setStatus } = await fixture(async () => 'verified');
 await controller.command('reauth');
 setStatus({ kind: 'authenticated', session: { user: { id: 'another-actor' }, expiresAt: Number.MAX_SAFE_INTEGER } });
 await controller.command('propose', proposal);
 expect(transfer).not.toHaveBeenCalled();
});

it('sends one exact transfer request per verified reauthentication', async () => {
 const { controller, transfer } = await fixture(async () => 'verified');
 await controller.command('propose', proposal);
 expect(transfer).not.toHaveBeenCalled();
 expect((await controller.command('reauth')).adminReauth).toBe('verified');
 await Promise.all([controller.command('propose', proposal), controller.command('propose', proposal)]);
 await controller.command('propose', proposal);
 expect(transfer).toHaveBeenCalledExactlyOnceWith('ws_v1_propose_admin_change', {
  p_school_id: school, p_target_membership_id: 'target', p_mode: 'transfer', p_request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
 });
});

it('requires separate verified reauthentication to accept a transfer', async () => {
 const { controller, transfer } = await fixture(async () => 'verified', 'HEALTH_TEACHER');
 const acceptance = { id: 'request', version: 1 };
 await controller.command('accept', acceptance);
 expect(transfer).not.toHaveBeenCalled();
 await controller.command('reauth');
 await controller.command('accept', acceptance);
 expect(transfer).toHaveBeenCalledExactlyOnceWith('ws_v1_accept_admin_change', {
  p_school_id: school, p_transfer_id: 'request', p_expected_version: 1, p_request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
 });
});

it('discards a previous verification when the next reauthentication is cancelled', async () => {
 const reauthenticate = vi.fn<NonNullable<SchoolPort['reauthenticate']>>()
  .mockResolvedValueOnce('verified')
  .mockResolvedValueOnce('cancelled');
 const { controller, transfer } = await fixture(reauthenticate);
 await controller.command('reauth');

 const cancelled = await controller.command('reauth');
 await controller.command('propose', proposal);

 expect(cancelled.adminReauth).toBe('required');
 expect(cancelled.reauthNotice).toContain('취소');
 expect(transfer).not.toHaveBeenCalled();
});

it('still requires the server to accept the request after verification', async () => {
 const { controller, transfer } = await fixture(async () => 'verified');
 transfer.mockRejectedValueOnce(Error('reauth'));
 await controller.command('reauth');

 const denied = await controller.command('propose', proposal);
 await controller.command('propose', proposal);

 expect(denied.adminReauth).toBe('required');
 expect(denied.notice).toContain('다시 로그인');
 expect(transfer).toHaveBeenCalledTimes(1);
});

it('blocks direct acceptance by a verified administrator before the RPC', async () => {
 const { controller, transfer } = await fixture(async () => 'verified');
 await controller.command('reauth');

 const denied = await controller.command('accept', { id: 'request', version: 1 });

 expect(denied.notice).toContain('권한');
 expect(transfer).not.toHaveBeenCalled();
});
