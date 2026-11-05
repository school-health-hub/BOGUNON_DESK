# 정확한 RPC 서명 및 GRANT 검토표

PG17 카탈로그 기준 공개54 = ws_v1_46 + 호환 이름8. 입력/반환/기본값은 아래와 JSON catalog에 기록한다.

초기 설치: 모든54 PUBLIC/anon/authenticated EXECUTE 없음. 표의 권한은 명시적 격리 QA 활성화 이후 값이다.

| 공개 서명 | 입력 이름/기본값 | 반환 | QA authenticated / anon / PUBLIC |
|---|---|---|---|
| `ws_c_membership_status(uuid)` | `p_school_id uuid` | `jsonb` | True / False / False |
| `ws_s02_admin(uuid)` | `s uuid` | `jsonb` | True / False / False |
| `ws_s02_directory(text,text)` | `q text, o text` | `jsonb` | True / False / False |
| `ws_s02_expiry(uuid,uuid,timestamp with time zone,bigint,uuid)` | `s uuid, mid uuid, until_at timestamp with time zone, ev bigint, r uuid` | `jsonb` | True / False / False |
| `ws_s02_self()` | `` | `jsonb` | True / False / False |
| `ws_s02_space(uuid,uuid)` | `s uuid, r uuid` | `jsonb` | True / False / False |
| `ws_s02_transfers(uuid)` | `s uuid` | `jsonb` | True / False / False |
| `ws_s02_withdraw(uuid,uuid,bigint,uuid)` | `s uuid, j uuid, ev bigint, r uuid` | `jsonb` | True / False / False |
| `ws_v1_accept_admin_change(uuid,uuid,bigint,uuid)` | `p_school_id uuid, p_transfer_id uuid, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_ack_handover(uuid,uuid,uuid,bigint,uuid)` | `p_school_id uuid, p_handover_id uuid, p_membership_id uuid, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_adjust_inventory(uuid,jsonb,bigint,uuid)` | `p_school_id uuid, p_payload jsonb, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_assign_task(uuid,uuid,uuid[],bigint,uuid)` | `p_school_id uuid, p_task_id uuid, p_assignees uuid[], p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_bootstrap()` | `` | `jsonb` | True / False / False |
| `ws_v1_cancel_event(uuid,uuid,bigint,uuid)` | `p_school_id uuid, p_event_id uuid, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_change_assigned_task_status(uuid,uuid,text,bigint,uuid)` | `p_school_id uuid, p_task_id uuid, p_status text, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_close_task(uuid,uuid,text,bigint,uuid)` | `p_school_id uuid, p_task_id uuid, p_mode text, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_complete_handover(uuid,uuid,boolean,bigint,uuid)` | `p_school_id uuid, p_handover_id uuid, p_completed boolean, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_create_handover(uuid,text,text,uuid[],text[],bigint,uuid)` | `p_school_id uuid, p_title text, p_body text, p_member_ids uuid[], p_target_roles text[], p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_create_inventory_item(uuid,jsonb,bigint,uuid)` | `p_school_id uuid, p_payload jsonb, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_create_task(uuid,text,text,text,date,uuid[],uuid)` | `p_school_id uuid, p_title text, p_description text, p_priority text, p_due_date date, p_assignees uuid[], p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_decide_join(uuid,uuid,text,text,timestamp with time zone,bigint,uuid)` | `p_school_id uuid, p_join_request_id uuid, p_decision text, p_approved_role text, p_valid_until timestamp with time zone, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_dispose_inventory(uuid,jsonb,bigint,uuid)` | `p_school_id uuid, p_payload jsonb, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_edit_handover(uuid,uuid,text,text,uuid[],text[],bigint,uuid)` | `p_school_id uuid, p_handover_id uuid, p_title text, p_body text, p_member_ids uuid[], p_target_roles text[], p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_edit_inventory_item(uuid,jsonb,bigint,uuid)` | `p_school_id uuid, p_payload jsonb, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_edit_task(uuid,uuid,text,text,text,date,bigint,uuid)` | `p_school_id uuid, p_task_id uuid, p_title text, p_description text, p_priority text, p_due_date date, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_get_activity_context(uuid)` | `p_school_id uuid` | `jsonb` | True / False / False |
| `ws_v1_get_context(uuid)` | `p_school_id uuid` | `jsonb` | True / False / False |
| `ws_v1_get_event(uuid,uuid)` | `p_school_id uuid, p_event_id uuid` | `jsonb` | True / False / False |
| `ws_v1_get_handover(uuid,uuid)` | `p_school_id uuid, p_handover_id uuid` | `jsonb` | True / False / False |
| `ws_v1_get_inventory_context(uuid,jsonb)` | `p_school_id uuid, p_payload jsonb` | `jsonb` | True / False / False |
| `ws_v1_get_inventory_item(uuid,jsonb)` | `p_school_id uuid, p_payload jsonb` | `jsonb` | True / False / False |
| `ws_v1_get_task(uuid,uuid)` | `p_school_id uuid, p_task_id uuid` | `jsonb` | True / False / False |
| `ws_v1_leave_school(uuid,bigint,uuid)` | `p_school_id uuid, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_list_event_history(uuid,uuid)` | `p_school_id uuid, p_event_id uuid` | `jsonb` | True / False / False |
| `ws_v1_list_events(uuid,timestamp with time zone,timestamp with time zone)` | `p_school_id uuid, p_from timestamp with time zone, p_to timestamp with time zone` | `jsonb` | True / False / False |
| `ws_v1_list_handover_history(uuid,uuid)` | `p_school_id uuid, p_handover_id uuid` | `jsonb` | True / False / False |
| `ws_v1_list_handovers(uuid)` | `p_school_id uuid` | `jsonb` | True / False / False |
| `ws_v1_list_inventory_alerts(uuid,jsonb)` | `p_school_id uuid, p_payload jsonb` | `jsonb` | True / False / False |
| `ws_v1_list_inventory_items(uuid,jsonb)` | `p_school_id uuid, p_payload jsonb` | `jsonb` | True / False / False |
| `ws_v1_list_inventory_locations(uuid,jsonb)` | `p_school_id uuid, p_payload jsonb` | `jsonb` | True / False / False |
| `ws_v1_list_inventory_lots(uuid,jsonb)` | `p_school_id uuid, p_payload jsonb` | `jsonb` | True / False / False |
| `ws_v1_list_inventory_movements(uuid,jsonb)` | `p_school_id uuid, p_payload jsonb` | `jsonb` | True / False / False |
| `ws_v1_list_task_history(uuid,uuid)` | `p_school_id uuid, p_task_id uuid` | `jsonb` | True / False / False |
| `ws_v1_list_tasks(uuid,text,text,text,boolean)` | `p_school_id uuid, p_status text, p_sort text, p_scope text, p_include_archived boolean` | `jsonb` | True / False / False |
| `ws_v1_propose_admin_change(uuid,uuid,text,uuid)` | `p_school_id uuid, p_target_membership_id uuid, p_mode text, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_receive_inventory(uuid,jsonb,bigint,uuid)` | `p_school_id uuid, p_payload jsonb, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_request_join(uuid,text,uuid)` | `p_school_id uuid, p_requested_role text, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_revoke_current_session(uuid)` | `p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_save_event(uuid,uuid,text,text,timestamp with time zone,timestamp with time zone,boolean,bigint,uuid)` | `p_school_id uuid, p_event_id uuid, p_title text, p_description text, p_start_at timestamp with time zone, p_end_at timestamp with time zone, p_all_day boolean, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_save_inventory_location(uuid,jsonb,bigint,uuid)` | `p_school_id uuid, p_payload jsonb, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_set_inventory_lot_state(uuid,jsonb,bigint,uuid)` | `p_school_id uuid, p_payload jsonb, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_set_member_role(uuid,uuid,text,bigint,uuid)` | `p_school_id uuid, p_membership_id uuid, p_new_role text, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_set_membership_state(uuid,uuid,text,bigint,uuid)` | `p_school_id uuid, p_membership_id uuid, p_state text, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |
| `ws_v1_use_inventory(uuid,jsonb,bigint,uuid)` | `p_school_id uuid, p_payload jsonb, p_expected_version bigint, p_request_id uuid` | `jsonb` | True / False / False |

## 내부 함수 실행 권한

| 서명 | 소유자 | SECURITY | QA authenticated EXECUTE |
|---|---|---|---|
| `workspace_private.accept_admin_change(uuid,uuid,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.actor()` | ws_authz_reader | DEFINER | False |
| `workspace_private.admin(uuid)` | ws_authz_reader | INVOKER | False |
| `workspace_private.allowed(uuid)` | ws_authz_reader | INVOKER | False |
| `workspace_private.bootstrap()` | ws_runtime | DEFINER | True |
| `workspace_private.bump(uuid)` | ws_runtime | INVOKER | False |
| `workspace_private.c_membership_status(uuid)` | ws_authz_reader | DEFINER | True |
| `workspace_private.decide_join(uuid,uuid,text,text,timestamp with time zone,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.enter(uuid,boolean)` | ws_runtime | INVOKER | False |
| `workspace_private.finish(uuid,uuid,text,jsonb,jsonb,uuid)` | ws_runtime | INVOKER | False |
| `workspace_private.get_context(uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.guard_last(uuid,uuid)` | ws_runtime | INVOKER | False |
| `workspace_private.immutable_identity()` | ws_owner | INVOKER | False |
| `workspace_private.leave_school(uuid,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.member_role(uuid)` | ws_authz_reader | DEFINER | False |
| `workspace_private.other_admin(uuid,uuid)` | ws_authz_reader | DEFINER | False |
| `workspace_private.promotion_allowed(uuid,uuid)` | ws_authz_reader | DEFINER | False |
| `workspace_private.propose_admin_change(uuid,uuid,text,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.receipt(uuid,uuid,text,jsonb)` | ws_runtime | INVOKER | False |
| `workspace_private.recent_login()` | ws_authz_reader | DEFINER | False |
| `workspace_private.request_join(uuid,text,uuid)` | ws_runtime | DEFINER | False |
| `workspace_private.revoke_current_session(uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s02_admin(uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s02_approval_time()` | ws_owner | INVOKER | False |
| `workspace_private.s02_directory(text,text)` | ws_authz_reader | DEFINER | True |
| `workspace_private.s02_expiry(uuid,uuid,timestamp with time zone,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s02_request_join(uuid,text,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s02_self()` | ws_authz_reader | DEFINER | True |
| `workspace_private.s02_space(uuid,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s02_transfers(uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s02_unclaimed(uuid)` | ws_authz_reader | DEFINER | False |
| `workspace_private.s02_withdraw(uuid,uuid,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s03_assign(uuid,uuid,uuid[])` | ws_runtime | INVOKER | False |
| `workspace_private.s03_assigned(uuid,uuid)` | ws_runtime | INVOKER | False |
| `workspace_private.s03_close(uuid,uuid,text,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s03_create(uuid,text,text,text,date,uuid[],uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s03_edit(uuid,uuid,text,text,text,date,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s03_get(uuid,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s03_guard()` | ws_runtime | INVOKER | False |
| `workspace_private.s03_hash(jsonb)` | ws_runtime | INVOKER | False |
| `workspace_private.s03_history(uuid,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s03_json(uuid,uuid)` | ws_runtime | INVOKER | False |
| `workspace_private.s03_list(uuid,text,text,text,boolean)` | ws_runtime | DEFINER | True |
| `workspace_private.s03_manage(uuid)` | ws_authz_reader | DEFINER | False |
| `workspace_private.s03_read(uuid)` | ws_authz_reader | DEFINER | False |
| `workspace_private.s03_reassign(uuid,uuid,uuid[],bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s03_record(uuid,uuid,text,text,uuid,jsonb)` | ws_runtime | INVOKER | False |
| `workspace_private.s03_safe(text,text)` | ws_runtime | INVOKER | False |
| `workspace_private.s03_status(uuid,uuid,text,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s03_valid_epoch(uuid,uuid)` | ws_authz_reader | DEFINER | False |
| `workspace_private.s04_author(uuid,uuid)` | ws_authz_reader | DEFINER | False |
| `workspace_private.s04_completable(uuid,uuid,bigint)` | ws_authz_reader | DEFINER | False |
| `workspace_private.s04_context(uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s04_create_allowed(uuid)` | ws_authz_reader | DEFINER | False |
| `workspace_private.s04_denied(uuid,text)` | ws_authz_reader | DEFINER | False |
| `workspace_private.s04_editable(uuid,uuid)` | ws_authz_reader | DEFINER | False |
| `workspace_private.s04_enter(uuid)` | ws_runtime | INVOKER | False |
| `workspace_private.s04_event_cancel(uuid,uuid,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s04_event_get(uuid,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s04_event_history(uuid,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s04_event_list(uuid,timestamp with time zone,timestamp with time zone)` | ws_runtime | DEFINER | True |
| `workspace_private.s04_event_save(uuid,uuid,text,text,timestamp with time zone,timestamp with time zone,boolean,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s04_expand(uuid,uuid[],text[])` | ws_runtime | INVOKER | False |
| `workspace_private.s04_guard()` | ws_runtime | INVOKER | False |
| `workspace_private.s04_manage(uuid)` | ws_authz_reader | DEFINER | False |
| `workspace_private.s04_note_ack(uuid,uuid,uuid,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s04_note_complete(uuid,uuid,boolean,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s04_note_create(uuid,text,text,uuid[],text[],bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s04_note_edit(uuid,uuid,text,text,uuid[],text[],bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s04_note_get(uuid,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s04_note_history(uuid,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s04_note_json(uuid,uuid)` | ws_runtime | INVOKER | False |
| `workspace_private.s04_note_list(uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s04_permission(uuid,text)` | ws_authz_reader | DEFINER | False |
| `workspace_private.s04_publish(uuid,uuid,bigint,text,text,uuid[],text[],uuid[])` | ws_runtime | INVOKER | False |
| `workspace_private.s04_safe(text,text)` | ws_runtime | INVOKER | False |
| `workspace_private.s04_target(uuid,uuid,bigint)` | ws_authz_reader | DEFINER | False |
| `workspace_private.s04_visible(uuid,uuid,bigint)` | ws_authz_reader | DEFINER | False |
| `workspace_private.s07_adjust_inventory(uuid,jsonb,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s07_create_inventory_item(uuid,jsonb,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s07_dispose_inventory(uuid,jsonb,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s07_edit_inventory_item(uuid,jsonb,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s07_get_inventory_context(uuid,jsonb)` | ws_runtime | DEFINER | True |
| `workspace_private.s07_get_inventory_item(uuid,jsonb)` | ws_runtime | DEFINER | True |
| `workspace_private.s07_list_inventory_alerts(uuid,jsonb)` | ws_runtime | DEFINER | True |
| `workspace_private.s07_list_inventory_items(uuid,jsonb)` | ws_runtime | DEFINER | True |
| `workspace_private.s07_list_inventory_locations(uuid,jsonb)` | ws_runtime | DEFINER | True |
| `workspace_private.s07_list_inventory_lots(uuid,jsonb)` | ws_runtime | DEFINER | True |
| `workspace_private.s07_list_inventory_movements(uuid,jsonb)` | ws_runtime | DEFINER | True |
| `workspace_private.s07_permission(uuid,text)` | ws_authz_reader | DEFINER | False |
| `workspace_private.s07_read(uuid,text,jsonb)` | ws_runtime | INVOKER | False |
| `workspace_private.s07_receive_inventory(uuid,jsonb,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s07_save_inventory_location(uuid,jsonb,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s07_set_inventory_lot_state(uuid,jsonb,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s07_soon_days()` | ws_runtime | INVOKER | False |
| `workspace_private.s07_today()` | ws_runtime | INVOKER | False |
| `workspace_private.s07_use_inventory(uuid,jsonb,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.s07_write(uuid,text,jsonb,bigint,uuid)` | ws_runtime | INVOKER | False |
| `workspace_private.school_open(uuid)` | ws_authz_reader | DEFINER | False |
| `workspace_private.session_ok()` | ws_authz_reader | DEFINER | False |
| `workspace_private.set_member_role(uuid,uuid,text,bigint,uuid)` | ws_runtime | DEFINER | True |
| `workspace_private.set_membership_state(uuid,uuid,text,bigint,uuid)` | ws_runtime | DEFINER | True |
