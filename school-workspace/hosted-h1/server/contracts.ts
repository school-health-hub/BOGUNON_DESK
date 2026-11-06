// Exact D0 public54 argument names plus a separate CLOSED Instructor addon2.
export const rpcArgs={
  "ws_c_membership_status": [
    "p_school_id"
  ],
  "ws_s02_admin": [
    "s"
  ],
  "ws_s02_directory": [
    "q",
    "o"
  ],
  "ws_s02_expiry": [
    "s",
    "mid",
    "until_at",
    "ev",
    "r"
  ],
  "ws_s02_self": [],
  "ws_s02_space": [
    "s",
    "r"
  ],
  "ws_s02_transfers": [
    "s"
  ],
  "ws_s02_withdraw": [
    "s",
    "j",
    "ev",
    "r"
  ],
  "ws_v1_accept_admin_change": [
    "p_school_id",
    "p_transfer_id",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_ack_handover": [
    "p_school_id",
    "p_handover_id",
    "p_membership_id",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_adjust_inventory": [
    "p_school_id",
    "p_payload",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_assign_task": [
    "p_school_id",
    "p_task_id",
    "p_assignees",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_bootstrap": [],
  "ws_v1_cancel_event": [
    "p_school_id",
    "p_event_id",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_change_assigned_task_status": [
    "p_school_id",
    "p_task_id",
    "p_status",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_close_task": [
    "p_school_id",
    "p_task_id",
    "p_mode",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_complete_handover": [
    "p_school_id",
    "p_handover_id",
    "p_completed",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_create_handover": [
    "p_school_id",
    "p_title",
    "p_body",
    "p_member_ids",
    "p_target_roles",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_create_inventory_item": [
    "p_school_id",
    "p_payload",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_create_task": [
    "p_school_id",
    "p_title",
    "p_description",
    "p_priority",
    "p_due_date",
    "p_assignees",
    "p_request_id"
  ],
  "ws_v1_decide_join": [
    "p_school_id",
    "p_join_request_id",
    "p_decision",
    "p_approved_role",
    "p_valid_until",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_dispose_inventory": [
    "p_school_id",
    "p_payload",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_edit_handover": [
    "p_school_id",
    "p_handover_id",
    "p_title",
    "p_body",
    "p_member_ids",
    "p_target_roles",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_edit_inventory_item": [
    "p_school_id",
    "p_payload",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_edit_task": [
    "p_school_id",
    "p_task_id",
    "p_title",
    "p_description",
    "p_priority",
    "p_due_date",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_get_activity_context": [
    "p_school_id"
  ],
  "ws_v1_get_context": [
    "p_school_id"
  ],
  "ws_v1_get_event": [
    "p_school_id",
    "p_event_id"
  ],
  "ws_v1_get_handover": [
    "p_school_id",
    "p_handover_id"
  ],
  "ws_v1_get_inventory_context": [
    "p_school_id",
    "p_payload"
  ],
  "ws_v1_get_inventory_item": [
    "p_school_id",
    "p_payload"
  ],
  "ws_v1_get_task": [
    "p_school_id",
    "p_task_id"
  ],
  "ws_v1_leave_school": [
    "p_school_id",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_list_event_history": [
    "p_school_id",
    "p_event_id"
  ],
  "ws_v1_list_events": [
    "p_school_id",
    "p_from",
    "p_to"
  ],
  "ws_v1_list_handover_history": [
    "p_school_id",
    "p_handover_id"
  ],
  "ws_v1_list_handovers": [
    "p_school_id"
  ],
  "ws_v1_list_inventory_alerts": [
    "p_school_id",
    "p_payload"
  ],
  "ws_v1_list_inventory_items": [
    "p_school_id",
    "p_payload"
  ],
  "ws_v1_list_inventory_locations": [
    "p_school_id",
    "p_payload"
  ],
  "ws_v1_list_inventory_lots": [
    "p_school_id",
    "p_payload"
  ],
  "ws_v1_list_inventory_movements": [
    "p_school_id",
    "p_payload"
  ],
  "ws_v1_list_task_history": [
    "p_school_id",
    "p_task_id"
  ],
  "ws_v1_list_tasks": [
    "p_school_id",
    "p_status",
    "p_sort",
    "p_scope",
    "p_include_archived"
  ],
  "ws_v1_propose_admin_change": [
    "p_school_id",
    "p_target_membership_id",
    "p_mode",
    "p_request_id"
  ],
  "ws_v1_receive_inventory": [
    "p_school_id",
    "p_payload",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_request_join": [
    "p_school_id",
    "p_requested_role",
    "p_request_id"
  ],
  "ws_v1_revoke_current_session": [
    "p_request_id"
  ],
  "ws_v1_save_event": [
    "p_school_id",
    "p_event_id",
    "p_title",
    "p_description",
    "p_start_at",
    "p_end_at",
    "p_all_day",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_save_inventory_location": [
    "p_school_id",
    "p_payload",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_set_inventory_lot_state": [
    "p_school_id",
    "p_payload",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_set_member_role": [
    "p_school_id",
    "p_membership_id",
    "p_new_role",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_set_membership_state": [
    "p_school_id",
    "p_membership_id",
    "p_state",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_use_inventory": [
    "p_school_id",
    "p_payload",
    "p_expected_version",
    "p_request_id"
  ],
  "ws_v1_instructor_read": [
    "p_school_id",
    "p_month"
  ],
  "ws_v1_instructor_write": [
    "p_school_id",
    "p_kind",
    "p_payload",
    "p_expected_version",
    "p_request_id"
  ]
} as const;
export type RpcName=keyof typeof rpcArgs;
