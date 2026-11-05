-- Synthetic A/B memberships; user 3 is teacher A, assistant B. No real school data.
BEGIN;
INSERT INTO workspace.school_memberships(id,school_id,actor_id,member_code,role,status,valid_until) VALUES
 ('20000000-0000-0000-0000-000000000103','10000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000003','M-C-B-ASSIST','HEALTH_ASSISTANT','active',statement_timestamp()+interval '30 days');
INSERT INTO workspace.membership_terms(school_id,membership_id,epoch) VALUES
 ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000103',1);
COMMIT;
