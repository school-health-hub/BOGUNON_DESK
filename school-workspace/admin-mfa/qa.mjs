import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, open, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const bin = process.env.BOGUNON_MFA_PG_BIN;
const temp = process.env.BOGUNON_MFA_QA_TEMP;
assert(bin && temp, 'Set BOGUNON_MFA_PG_BIN and BOGUNON_MFA_QA_TEMP to existing local directories');
const parent = await realpath(temp);
const owned = await mkdtemp(join(parent, 'bogunon-admin-mfa-'));
const data = join(owned, 'data');
const pg = promisify(execFile);
const pgEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key)));
pgEnv.PGCLIENTENCODING = 'UTF8';
const run = (tool, args) => pg(join(bin, process.platform === 'win32' ? tool + '.exe' : tool), args, {
 windowsHide: true, timeout: 60_000, env: pgEnv,
});
async function control(args) {
 const log = await open(join(owned, 'pg-ctl.log'), 'a');
 try {
  await new Promise((done, fail) => {
   const child = spawn(join(bin, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'), args, {
    windowsHide: true, env: pgEnv, stdio: ['ignore', log.fd, log.fd],
   });
   child.once('error', fail);
   child.once('exit', code => code === 0 ? done() : fail(new Error('pg_ctl failed: ' + code)));
  });
 } finally { await log.close(); }
}
const listener = createServer();
await new Promise((done, fail) => listener.once('error', fail).listen(0, '127.0.0.1', done));
const port = String(listener.address().port);
await new Promise(done => listener.close(done));
const root = resolve(import.meta.dirname, '..');
const files = name => readFile(join(root, name), 'utf8');
const quote = value => value === null ? 'NULL' : "'" + String(value).replaceAll("'", "''") + "'";
const owner = 'fixture_root';
async function sql(query, user = owner) {
 const path = join(owned, randomUUID() + '.sql');
 await writeFile(path, query);
 try {
  const result = await run('psql', ['-XqAt', '-w', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', port, '-U', user, '-d', 'postgres', '-f', path]);
  return result.stdout.trim().split(/\r?\n/).at(-1);
 } catch (error) {
  throw new Error(error.stderr || error.message, { cause: error });
 }
}
const frozenPlan = JSON.parse(await files('school09d0/INSTALL_PLAN.json'));
const markers = "SET bogunon.workspace_target=" + quote(frozenPlan.review_project_ref) + ";SET bogunon.workspace_plan='SCHOOL-09D-0:CLOSED';";
const candidateMarker = "SET bogunon.admin_mfa_plan='REVIEW-CLOSED';";
const makeId = (prefix, n) => prefix + '-0000-0000-0000-' + String(n).padStart(12, '0');
const userId = i => makeId('00000000', i);
const sid = i => makeId('30000000', i);
const mid = i => makeId('20000000', i);
const school = makeId('10000000', 1);
const otherSchool = makeId('10000000', 3);
const roleClaims = (i, session = sid(i), aal = 'aal2') => quote(JSON.stringify({
 sub: userId(i), session_id: session, aal, is_anonymous: false, exp: 2_000_000_000,
 amr: [{ method: 'totp', timestamp: 1_700_000_000 }],
}));
const call = (i, name, args, session, aal) => sql(
 'BEGIN;SET LOCAL ROLE authenticated;SET LOCAL "request.jwt.claims"=' + roleClaims(i, session, aal) +
 ';SELECT workspace_admin_mfa.' + name + '(' + args.map(quote).join(',') + ');COMMIT;',
 'school_client',
);
const verify = (i, name, intent, factor, session = sid(i)) => sql(
 'BEGIN;SET LOCAL ROLE ws_admin_mfa_verifier;SELECT workspace_admin_mfa.' + name +
 '(' + [intent, userId(i), session, factor].map(quote).join(',') + ');COMMIT;',
);
const begin = (i = 1, purpose = 'propose', target = mid(3), where = school, mode = 'transfer', version = null) =>
 call(i, 'begin_intent', [where, purpose, target, mode, version]);
const execute = (i, intent, where = school, session, aal) => call(i, 'execute_intent', [intent, where], session, aal);
const verified = async (i, intent) => {
 const factor = randomUUID();
 await verify(i, 'bind_factor', intent, factor);
 await verify(i, 'attest_factor', intent, factor);
 return factor;
};
const state = (i, schoolRole) => sql('SELECT role FROM workspace.school_memberships WHERE id=' + quote(mid(i)))
 .then(role => assert.equal(role, schoolRole));
const proofOpen = intent => sql('SELECT closed_at IS NULL FROM workspace_admin_mfa.intents WHERE id=' + quote(intent));
const clearTransfers = () => sql('DELETE FROM workspace.admin_transfers');
let started = false;
let stopped = false;
let count = 0;
const pass = name => { count++; console.log('PASS ' + name); };
try {
 await run('initdb', ['-D', data, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--no-locale']);
 await control(['-D', data, '-l', join(owned, 'server.log'), '-o', '-h 127.0.0.1 -p ' + port, '-w', 'start']);
 started = true;
 for (const path of ['local/tests/auth_fixture.sql', 'school06/tests/bootstrap.sql']) {
  await sql((await files(path)).replaceAll("'school01a'", "'postgres'"), 'postgres');
 }
 await sql('CREATE ROLE fixture_setup LOGIN SUPERUSER', 'postgres');
 await sql('ALTER ROLE postgres RENAME TO fixture_root', 'fixture_setup');
 await sql(`CREATE ROLE postgres LOGIN NOSUPERUSER BYPASSRLS CREATEROLE NOINHERIT;
 GRANT CREATE ON DATABASE postgres TO postgres; GRANT USAGE,CREATE ON SCHEMA public TO postgres WITH GRANT OPTION;
 GRANT USAGE ON SCHEMA auth TO postgres; GRANT REFERENCES(id) ON auth.users TO postgres;
 GRANT SELECT(id,user_id,created_at,not_after) ON auth.sessions TO postgres;
 GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO postgres;
 CREATE ROLE supabase_admin NOLOGIN NOBYPASSRLS; ALTER SCHEMA auth OWNER TO supabase_admin;
 GRANT USAGE ON SCHEMA auth TO supabase_auth_admin; CREATE ROLE service_role NOLOGIN NOBYPASSRLS;`);
 const frozenInstall = await files('school09d0/sql/01-install-closed-candidate.sql');
 await sql(markers + frozenInstall, 'postgres');
 const fingerprintTail = frozenInstall.slice(frozenInstall.lastIndexOf('INSERT INTO workspace_private.h3_release'));
 const hashStart = fingerprintTail.indexOf('SELECT md5(');
 const hashEnd = fingerprintTail.indexOf(')q)))', hashStart);
 assert(hashStart >= 0 && hashEnd > hashStart);
 const liveHash = fingerprintTail.slice(hashStart, hashEnd + 2);
 const fingerprint = await sql(liveHash);
 assert.equal(await sql('SELECT fingerprint FROM workspace_private.h3_release'), fingerprint);
 const freeze = `SELECT md5(jsonb_agg(to_jsonb(r) ORDER BY r.oid)::text) FROM (
 SELECT p.oid,p.proacl,pg_get_functiondef(p.oid) AS def FROM pg_proc p
 WHERE p.oid IN (SELECT public_signature::regprocedure FROM workspace_private.h3_rpc_manifest
 UNION SELECT private_signature::regprocedure FROM workspace_private.h3_rpc_manifest)) r`;
 const before = await sql(freeze);
 const ledger = 'SELECT state||\':\'||fingerprint FROM workspace_private.h3_release';
 const releaseBefore = await sql(ledger);
 await sql(`ALTER DEFAULT PRIVILEGES FOR ROLE ws_runtime GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
 ALTER DEFAULT PRIVILEGES FOR ROLE ws_runtime GRANT SELECT ON TABLES TO authenticated;
 ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT USAGE ON SCHEMAS TO authenticated;`);
 const candidate = await files('admin-mfa/closed-candidate.sql');
 await assert.rejects(sql(candidate, 'postgres'), /admin_mfa_closed_review_required/);
 await sql(candidateMarker + candidate, 'postgres');
 assert.equal(await sql(freeze), before);
 assert.equal(await sql(ledger), releaseBefore);
 assert.equal(await sql(liveHash), fingerprint);
 assert.equal(await sql("SELECT has_schema_privilege('authenticated','workspace_admin_mfa','USAGE') OR has_table_privilege('authenticated','workspace_admin_mfa.intents','SELECT') OR has_function_privilege('service_role','workspace_admin_mfa.attest_factor(uuid,uuid,uuid,uuid)','EXECUTE')"), 'f');
 await assert.rejects(begin(), /permission denied/);
 await assert.rejects(sql("SET ROLE authenticated;SELECT public.ws_v1_propose_admin_change(NULL,NULL,NULL,NULL);", 'school_client'), /permission denied/);
 pass('CLOSED install, default ACL scrubbing, frozen Core definitions/ACL and ledger unchanged');

 // Synthetic-only grants, never emitted by the review candidate or to any provider.
 await sql(`GRANT USAGE ON SCHEMA workspace_admin_mfa TO authenticated;
 GRANT EXECUTE ON FUNCTION workspace_admin_mfa.begin_intent(uuid,text,uuid,text,bigint),
 workspace_admin_mfa.execute_intent(uuid,uuid),workspace_admin_mfa.cancel_intent(uuid) TO authenticated;`);
 await sql(await files('local/tests/fixtures.sql'));
 const initial = await begin();
 await assert.rejects(execute(1, initial), /admin_mfa_required/);
 await assert.rejects(execute(1, initial, school, sid(1), 'aal1'), /admin_mfa_required/);
 const oldFactor = randomUUID();
 await assert.rejects(verify(1, 'attest_factor', initial, oldFactor), /attestation_denied/);
 await assert.rejects(call(1, 'attest_factor', [initial, userId(1), sid(1), oldFactor]), /permission denied/);
 pass('existing aal2/aal1, pre-binding MFA and client attestation denied');

 const factor = await verified(1, initial);
 await assert.rejects(verify(2, 'attest_factor', initial, factor), /attestation_denied/);
 await assert.rejects(verify(1, 'attest_factor', initial, factor, randomUUID()), /attestation_denied/);
 await assert.rejects(verify(1, 'attest_factor', initial, factor), /attestation_denied/);
 await assert.rejects(execute(2, initial), /admin_mfa_required/);
 await assert.rejects(execute(1, initial, otherSchool), /admin_mfa_required/);
 const newSession = randomUUID();
 await sql('INSERT INTO auth.sessions(id,user_id) VALUES (' + quote(newSession) + ',' + quote(userId(1)) + ')');
 await assert.rejects(execute(1, initial, school, newSession), /admin_mfa_required/);
 const race = await Promise.allSettled([execute(1, initial), execute(1, initial)]);
 const win = race.filter(result => result.status === 'fulfilled');
 assert.equal(win.length, 1);
 assert.match(race.find(result => result.status === 'rejected').reason.message, /admin_mfa_required/);
 const transfer = JSON.parse(win[0].value).transfer_id;
 assert.equal(await sql('SELECT count(*) FROM workspace.admin_transfers'), '1');
 pass('trusted bound evidence, wrong actor/school/session rejection and atomic concurrent consumption');

 const accept = await begin(3, 'accept', transfer, school, null, 1);
 await verified(3, accept);
 assert.deepEqual(JSON.parse(await execute(3, accept)), { accepted: true });
 await state(3, 'SCHOOL_ADMIN');
 await state(1, 'HEALTH_TEACHER');
 await assert.rejects(execute(3, accept), /admin_mfa_required/);
 pass('one-time acceptance rechecks teacher and atomically changes both roles');

 const expired = await begin(2, 'propose', mid(1));
 const expiredFactor = randomUUID();
 await verify(2, 'bind_factor', expired, expiredFactor);
 await sql("UPDATE workspace_admin_mfa.intents SET issued_at=clock_timestamp()-interval '3 minutes',expires_at=clock_timestamp()-interval '1 minute' WHERE id=" + quote(expired));
 await assert.rejects(verify(2, 'attest_factor', expired, expiredFactor), /attestation_denied/);
 await assert.rejects(execute(2, expired), /admin_mfa_required/);
 const cancelled = await begin(2, 'propose', mid(1));
 const failedFactor = randomUUID();
 await verify(2, 'bind_factor', cancelled, failedFactor);
 await assert.rejects(execute(2, cancelled), /admin_mfa_required/);
 await call(2, 'cancel_intent', [cancelled]);
 await assert.rejects(verify(2, 'attest_factor', cancelled, failedFactor), /attestation_denied/);
 pass('expiry, failed/unattested factor and cancellation deny use');

 const previous = await begin(2, 'propose', mid(1));
 await verified(2, previous);
 await begin(2, 'propose', mid(1), otherSchool);
 await assert.rejects(execute(2, previous), /admin_mfa_required/);
 const logout = await begin(2, 'propose', mid(1));
 await verified(2, logout);
 await sql('DELETE FROM auth.sessions WHERE id=' + quote(sid(2)));
 await assert.rejects(execute(2, logout), /unauthenticated_or_revoked/);
 await sql('INSERT INTO auth.sessions(id,user_id) VALUES (' + quote(sid(2)) + ',' + quote(userId(2)) + ')');
 pass('new school intent invalidates previous intent and revoked Auth session cannot execute');

 const changed = await begin(2, 'propose', mid(1));
 await verified(2, changed);
 await sql("UPDATE workspace.school_memberships SET version=version+1 WHERE id=" + quote(mid(2)));
 await assert.rejects(execute(2, changed), /admin_mfa_membership_changed/);
 const revoked = await begin(2, 'propose', mid(1));
 await verified(2, revoked);
 await sql("UPDATE workspace.school_memberships SET status='suspended',version=version+1 WHERE id=" + quote(mid(2)));
 await assert.rejects(execute(2, revoked), /access_denied/);
 await sql("UPDATE workspace.school_memberships SET status='active',version=version+1 WHERE id=" + quote(mid(2)));
 const oldSession = await begin(2, 'propose', mid(1));
 await verified(2, oldSession);
 await sql("UPDATE auth.sessions SET created_at=clock_timestamp()-interval '11 minutes' WHERE id=" + quote(sid(2)));
 await assert.rejects(execute(2, oldSession), /reauth_required/);
 assert.equal(await proofOpen(oldSession), 't');
 await sql('UPDATE auth.sessions SET created_at=clock_timestamp() WHERE id=' + quote(sid(2)));
 const bad = await begin(2, 'propose', mid(4));
 await verified(2, bad);
 const beforeBad = await sql('SELECT count(*) FROM workspace.admin_transfers');
 await assert.rejects(execute(2, bad), /eligible_teacher_required/);
 assert.equal(await proofOpen(bad), 't');
 assert.equal(await sql('SELECT count(*) FROM workspace.admin_transfers'), beforeBad);
 pass('membership version recheck, frozen recent-session predicate and failed proposal roll back proof consumption');

 const targetIntent = await begin(2, 'propose', mid(1));
 const oldBound = await verified(2, targetIntent);
 const waiting = JSON.parse(await execute(2, targetIntent)).transfer_id;
 const incoming = await begin(1, 'accept', waiting, school, null, 1);
 await assert.rejects(verify(1, 'bind_factor', incoming, oldBound), /unique constraint/);
 await verified(1, incoming);
 await sql("UPDATE workspace.school_memberships SET role='HEALTH_TEACHER',version=version+1 WHERE id=" + quote(mid(2)));
 await assert.rejects(execute(1, incoming), /admin_mfa_inviter_changed/);
 await state(1, 'HEALTH_TEACHER');
 assert.equal(await proofOpen(incoming), 't');
 await clearTransfers();
 pass('factor ID replay across intents and exact inviter demotion denied');

 const rollbackIntent = await begin(3, 'propose', mid(1));
 const rollbackTransfer = JSON.parse(await (async () => {
  await verified(3, rollbackIntent);
  return execute(3, rollbackIntent);
 })()).transfer_id;
 const rollback = await begin(1, 'accept', rollbackTransfer, school, null, 1);
 await verified(1, rollback);
 await sql("CREATE FUNCTION public.qa_fail_history() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic_failure_after_role_writes';END$$; CREATE TRIGGER qa_fail_history BEFORE INSERT ON workspace.role_change_history FOR EACH ROW EXECUTE FUNCTION public.qa_fail_history();");
 await assert.rejects(execute(1, rollback), /synthetic_failure_after_role_writes/);
 await state(1, 'HEALTH_TEACHER');
 await state(3, 'SCHOOL_ADMIN');
 assert.equal(await proofOpen(rollback), 't');
 assert.equal(await sql('SELECT state FROM workspace.admin_transfers WHERE id=' + quote(rollbackTransfer)), 'proposed');
 await sql('DROP TRIGGER qa_fail_history ON workspace.role_change_history; DROP FUNCTION public.qa_fail_history()');
 pass('failure after role writes rolls back both roles, transfer state and proof');

 await sql('GRANT EXECUTE ON FUNCTION public.ws_v1_propose_admin_change(uuid,uuid,text,uuid) TO authenticated');
 await assert.rejects(execute(1, rollback), /legacy_admin_transfer_must_stay_closed/);
 await sql('REVOKE EXECUTE ON FUNCTION public.ws_v1_propose_admin_change(uuid,uuid,text,uuid) FROM authenticated');
 assert.equal(await sql(freeze), before);
 assert.equal(await sql(ledger), releaseBefore);
 assert.equal(await sql(liveHash), fingerprint);
 pass('candidate refuses operation with old client ACL open, frozen catalog and ledger match after QA');
 console.log('PASS ' + count + ' PostgreSQL scenarios, synthetic verifier only');
} finally {
 if (started || await access(join(data, 'postmaster.pid')).then(() => true, () => false)) {
  await control(['-D', data, '-m', 'fast', '-w', 'stop']);
  stopped = true;
 }
 const path = await realpath(owned);
 if ((!started || stopped) && path === owned && dirname(path) === parent) await rm(path, { recursive: true });
}
