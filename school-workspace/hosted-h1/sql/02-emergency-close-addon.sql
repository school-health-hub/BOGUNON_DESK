-- Review-only recovery: never activates the parent or the addon. No rows removed.
BEGIN;SELECT pg_advisory_xact_lock(hashtextextended('bogunon:h1:instructor',0));
SET LOCAL ROLE ws_owner;
UPDATE workspace_instructor_private.release SET state='closed';
REVOKE ALL ON FUNCTION public.ws_v1_instructor_read(uuid,text),public.ws_v1_instructor_write(uuid,text,jsonb,bigint,uuid)FROM PUBLIC,anon,authenticated,service_role;
SET LOCAL ROLE ws_runtime;
REVOKE ALL ON FUNCTION workspace_instructor_private.instructor_read(uuid,text),workspace_instructor_private.instructor_write(uuid,text,jsonb,bigint,uuid)FROM PUBLIC,anon,authenticated,service_role;
RESET ROLE;COMMIT;
