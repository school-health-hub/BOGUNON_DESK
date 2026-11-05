-- Synthetic first-admin verification fixtures only; no real institution was verified.
BEGIN;
SET LOCAL client_min_messages='warning';
TRUNCATE workspace.schools CASCADE;
TRUNCATE workspace.accounts CASCADE;
TRUNCATE auth.users CASCADE;
INSERT INTO auth.users SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid FROM generate_series(1,10)i;
INSERT INTO auth.sessions(id,user_id) SELECT ('30000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid FROM generate_series(1,10)i;
INSERT INTO workspace.accounts(id,user_id) SELECT ('40000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid FROM generate_series(1,10)i;
INSERT INTO workspace.schools(id,office_code,school_code,name,state) VALUES
 ('10000000-0000-0000-0000-000000000001','B10','9000001','SYNTHETIC A','active'),
 ('10000000-0000-0000-0000-000000000002','B10','9000002','SYNTHETIC B','active'),
 ('10000000-0000-0000-0000-000000000003','B10','9000003','SYNTHETIC RACE','active');
INSERT INTO workspace.school_memberships(id,school_id,actor_id,member_code,role,status,valid_from,valid_until)
SELECT ('20000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,
 ('10000000-0000-0000-0000-'||lpad((CASE WHEN i=6 THEN 2 ELSE 1 END)::text,12,'0'))::uuid,
 ('40000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'M-SYNTH-'||i,
 CASE WHEN i IN(1,2,6) THEN 'SCHOOL_ADMIN' WHEN i=4 THEN 'HEALTH_ASSISTANT' WHEN i=5 THEN NULL ELSE 'HEALTH_TEACHER' END,
 CASE WHEN i=5 THEN 'pending' ELSE 'active' END,
 clock_timestamp()-interval '2 days',CASE WHEN i=8 THEN clock_timestamp()-interval '1 day' WHEN i=4 THEN clock_timestamp()+interval '30 days' ELSE NULL END
 FROM generate_series(1,10)i WHERE i<>7;
INSERT INTO workspace.school_memberships(id,school_id,actor_id,member_code,role,status)
SELECT ('20000000-0000-0000-0000-'||lpad((100+i)::text,12,'0'))::uuid,'10000000-0000-0000-0000-000000000003',
 ('40000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'M-RACE-'||i,'SCHOOL_ADMIN','active' FROM generate_series(1,2)i;
INSERT INTO workspace.membership_terms(school_id,membership_id,epoch) SELECT school_id,id,epoch FROM workspace.school_memberships;
INSERT INTO workspace.join_requests(id,school_id,membership_id,epoch,requested_role) VALUES
 ('50000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000005',1,'HEALTH_TEACHER');
INSERT INTO workspace.first_admin_requests(school_id,actor_id,case_ref,state)
 SELECT id,'40000000-0000-0000-0000-000000000001',gen_random_uuid(),'verified' FROM workspace.schools;
INSERT INTO workspace.membership_permission_overrides VALUES
 ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000010',1,'handover.create','allow','school');
COMMIT;
