-- Additional synthetic assistant without an assignment, for negative authorization tests.
UPDATE workspace.school_memberships SET role='HEALTH_ASSISTANT',valid_until=clock_timestamp()+interval '30 days' WHERE member_code='M-SYNTH-9';
