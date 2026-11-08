import { expect, it, vi } from 'vitest';
import { AccountLoopback } from '../../../electron-p0/main/account-loopback.js';
import type { SecretSession } from '../../auth/server/ports.js';
import { H1Auth } from '../server/auth.js';
import { H1Http } from '../server/http.js';
import { createH1Runtime } from '../server/runtime.js';

const projectRef = 'abcdefghijklmnopqrst';
const origin = 'https://' + projectRef + '.supabase.co';
const uid = '00000000-0000-0000-0000-000000000003';
const user = { id: uid, aud: 'authenticated', role: 'authenticated', is_anonymous: false, app_metadata: {}, user_metadata: {} };

function fixture(verifiedUserId = uid) {
 let saved: SecretSession | null = null;
 const opened: URL[] = [];
 const calls: string[] = [];
 const http = new H1Http({ mode: 'hosted-candidate', origin, projectRef, publicKey: 'sb_publishable_fixture' }, async input => {
  const url = new URL(String(input));
  calls.push(url.pathname);
  if (url.pathname === '/auth/v1/token') {
   return Response.json({ user, access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_in: 3600, token_type: 'bearer' });
  }
  if (url.pathname === '/auth/v1/user') return Response.json({ ...user, id: verifiedUserId });
  if (url.pathname === '/rest/v1/rpc/ws_v1_bootstrap') return Response.json({ actor_id: uid });
  if (url.pathname === '/rest/v1/rpc/ws_s02_self') return Response.json({ memberships: [], space_requests: [] });
  return new Response(null, { status: 204 });
 });
 const auth = new H1Auth(http, {
  load: async () => saved, save: async session => { saved = session; }, clear: async () => { saved = null; },
 }, async url => { opened.push(new URL(url)); });
 const runtime = createH1Runtime(auth);
 const callback = async (attempt = 0) => {
  const url = await vi.waitFor(() => {
   const current = opened[attempt];
   if (!current) throw Error('Authorization URL not opened');
   return current;
  });
  expect(url.origin).toBe(origin);
  expect(url.searchParams.get('code_challenge_method')).toBe('s256');
  const redirect = new URL(url.searchParams.get('redirect_to') ?? '');
  expect(redirect.hostname).toBe('127.0.0.1');
  expect(redirect.searchParams.get('sb_flow_id')).toBeTruthy();
  return redirect;
 };
 return { auth, runtime, calls, callback, get saved() { return saved; } };
}

it('accepts only the current Google PKCE callback and verifies the user before saving', async () => {
 const f = fixture();
 try {
  const login = f.runtime.school('login', {});
  const redirect = await f.callback();
  const wrong = new URL(redirect);
  wrong.searchParams.set('sb_flow_id', 'different_flow');
  wrong.searchParams.set('code', 'synthetic-code');
  expect((await fetch(wrong)).status).toBe(400);
  expect(f.calls).toEqual([]);
  redirect.searchParams.set('code', 'synthetic-code');
  expect((await fetch(redirect)).ok).toBe(true);
  expect(await login).toMatchObject({ workspace: { phase: 'authenticated_unselected' }, adminMfa: { status: 'unsupported' } });
  expect(f.calls.slice(0, 2)).toEqual(['/auth/v1/token', '/auth/v1/user']);
  expect(f.saved?.userId).toBe(uid);
  await f.runtime.school('propose', { id: 'target', mode: 'transfer' });
  expect(f.calls).not.toContain('/rest/v1/rpc/ws_v1_propose_admin_change');
 } finally { await f.runtime.dispose(); }
});

it.each([
 ['access_denied', '취소'],
 ['server_error', '실패'],
])('reports Google callback %s without exchange or persisted session', async (error, notice) => {
 const f = fixture();
 try {
  const login = f.runtime.school('login', {});
  const redirect = await f.callback();
  redirect.searchParams.set('error', error);
  expect((await fetch(redirect)).ok).toBe(true);
  expect(await login).toMatchObject({ notice: expect.stringContaining(notice), adminMfa: { status: 'unsupported' } });
  expect(f.saved).toBeNull();
  expect(f.calls).toEqual([]);
 } finally { await f.runtime.dispose(); }
});

it('discards a pending Google login on sign out', async () => {
 const f = fixture();
 try {
  const login = f.runtime.school('login', {});
  const redirect = await f.callback();
  await f.runtime.school('logout', {});
  await login;
  redirect.searchParams.set('code', 'late-code');
  await expect(fetch(redirect)).rejects.toThrow();
  expect(await f.auth.status()).toMatchObject({ kind: 'signed_out' });
  expect(f.saved).toBeNull();
  expect(f.calls).toEqual([]);
 } finally { await f.runtime.dispose(); }
});


it('expires an unanswered callback and discards the loopback endpoint', async () => {
 const start = AccountLoopback.prototype.start;
 const shortTimeout = vi.spyOn(AccountLoopback.prototype, 'start').mockImplementation(function(this: AccountLoopback, callback, expired) {
  return start.call(this, callback, expired, 100);
 });
 const f = fixture();
 try {
  const login = f.runtime.school('login', {});
  const redirect = await f.callback();
  expect(await login).toMatchObject({ notice: expect.stringContaining('초과') });
  await expect(fetch(redirect)).rejects.toThrow();
  expect(f.calls).toEqual([]);
  expect(f.saved).toBeNull();
 } finally {
  shortTimeout.mockRestore();
  await f.runtime.dispose();
 }
});

it('discards a pending Google login when the school changes', async () => {
 const f = fixture();
 try {
  const login = f.runtime.school('login', {});
  const redirect = await f.callback();
  await f.runtime.school('select', { school: '10000000-0000-0000-0000-000000000001' });
  await login;
  await expect(fetch(redirect)).rejects.toThrow();
  expect(await f.auth.status()).toMatchObject({ kind: 'signed_out' });
  expect(f.saved).toBeNull();
  expect(f.calls).toEqual([]);
 } finally { await f.runtime.dispose(); }
});

it('does not persist a Google session when Auth verifies a different user', async () => {
 const f = fixture('00000000-0000-0000-0000-000000000004');
 try {
  const login = f.runtime.school('login', {});
  const redirect = await f.callback();
  redirect.searchParams.set('code', 'synthetic-code');
  expect((await fetch(redirect)).ok).toBe(true);
  expect(await login).toMatchObject({ notice: expect.stringContaining('실패') });
  expect(f.calls).toEqual(['/auth/v1/token', '/auth/v1/user']);
  expect(f.saved).toBeNull();
 } finally { await f.runtime.dispose(); }
});

it('keeps only the newer account login callback after starting over', async () => {
 const f = fixture();
 try {
  const first = f.runtime.school('login', {});
  const oldCallback = await f.callback();
  const second = f.runtime.school('login', {});
  const newCallback = await f.callback(1);
  await first;
  oldCallback.searchParams.set('code', 'old-code');
  await expect(fetch(oldCallback)).rejects.toThrow();
  newCallback.searchParams.set('code', 'new-code');
  expect((await fetch(newCallback)).ok).toBe(true);
  expect(await second).toMatchObject({ workspace: { phase: 'authenticated_unselected' }, adminMfa: { status: 'unsupported' } });
  expect(f.calls.filter(path => path === '/auth/v1/token')).toHaveLength(1);
 } finally { await f.runtime.dispose(); }
});
