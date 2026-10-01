use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "desktop-notifications.json";
const ENABLED_KEY: &str = "workspaceNotificationsEnabled";
const LAST_DATE_KEY: &str = "lastDailySummaryDate";
const REASONS_KEY: &str = "workspaceNotificationReasons";

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationReasonSettings {
    overdue: bool,
    due_today: bool,
    follow_up: bool,
    needs_check: bool,
}

impl Default for NotificationReasonSettings {
    fn default() -> Self {
        Self {
            overdue: true,
            due_today: true,
            follow_up: true,
            needs_check: true,
        }
    }
}

impl NotificationReasonSettings {
    fn has_enabled_reason(&self) -> bool {
        self.overdue || self.due_today || self.follow_up || self.needs_check
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettings {
    workspace_notifications_enabled: bool,
    workspace_notification_reasons: NotificationReasonSettings,
    last_daily_summary_date: Option<String>,
}

fn is_valid_date_key(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return false;
    }
    let year = value[0..4].parse::<u16>().ok();
    let month = value[5..7].parse::<u8>().ok();
    let day = value[8..10].parse::<u8>().ok();
    let (Some(year), Some(month), Some(day)) = (year, month, day) else {
        return false;
    };
    let leap_year = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days_in_month = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap_year => 29,
        2 => 28,
        _ => return false,
    };
    year > 0 && (1..=days_in_month).contains(&day)
}

fn load_settings(app: &AppHandle) -> Result<NotificationSettings, String> {
    let store = app.store(STORE_FILE).map_err(|error| error.to_string())?;
    let enabled = store
        .get(ENABLED_KEY)
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let last_date = store
        .get(LAST_DATE_KEY)
        .and_then(|value| value.as_str().map(str::to_owned))
        .filter(|value| is_valid_date_key(value));
    let reasons = store
        .get(REASONS_KEY)
        .and_then(|value| serde_json::from_value(value.clone()).ok())
        .unwrap_or_default();
    Ok(NotificationSettings {
        workspace_notifications_enabled: enabled,
        workspace_notification_reasons: reasons,
        last_daily_summary_date: last_date,
    })
}

#[tauri::command]
pub fn set_workspace_notification_reasons(
    app: AppHandle,
    reasons: NotificationReasonSettings,
) -> Result<NotificationSettings, String> {
    if !reasons.has_enabled_reason() {
        return Err("알림 종류를 하나 이상 선택해 주세요.".to_owned());
    }
    let store = app.store(STORE_FILE).map_err(|error| error.to_string())?;
    let value = serde_json::to_value(reasons).map_err(|error| error.to_string())?;
    store.set(REASONS_KEY, value);
    store.save().map_err(|error| error.to_string())?;
    load_settings(&app)
}

#[tauri::command]
pub fn get_notification_settings(app: AppHandle) -> Result<NotificationSettings, String> {
    load_settings(&app)
}

#[tauri::command]
pub fn set_workspace_notifications_enabled(
    app: AppHandle,
    enabled: bool,
) -> Result<NotificationSettings, String> {
    let store = app.store(STORE_FILE).map_err(|error| error.to_string())?;
    store.set(ENABLED_KEY, serde_json::Value::Bool(enabled));
    store.save().map_err(|error| error.to_string())?;
    load_settings(&app)
}

#[tauri::command]
pub fn mark_daily_summary_sent(app: AppHandle, date: String) -> Result<(), String> {
    if !is_valid_date_key(&date) {
        return Err("알림 날짜를 저장할 수 없습니다.".to_owned());
    }
    let store = app.store(STORE_FILE).map_err(|error| error.to_string())?;
    store.set(LAST_DATE_KEY, serde_json::Value::String(date));
    store.save().map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{is_valid_date_key, NotificationReasonSettings};

    #[test]
    fn accepts_local_date_keys() {
        assert!(is_valid_date_key("2026-09-22"));
    }

    #[test]
    fn rejects_malformed_date_keys() {
        assert!(!is_valid_date_key("2026-9-22"));
        assert!(!is_valid_date_key("not-a-date"));
        assert!(!is_valid_date_key("2026-13-22"));
        assert!(!is_valid_date_key("2026-02-29"));
        assert!(is_valid_date_key("2028-02-29"));
    }

    #[test]
    fn notification_reasons_default_to_all_enabled() {
        let reasons: NotificationReasonSettings =
            serde_json::from_value(serde_json::Value::Null).unwrap_or_default();
        assert!(reasons.overdue && reasons.due_today && reasons.follow_up && reasons.needs_check);
    }

    #[test]
    fn malformed_notification_reasons_fall_back_safely() {
        let reasons = serde_json::from_value::<NotificationReasonSettings>(
            serde_json::json!({ "overdue": "yes" }),
        )
        .unwrap_or_default();
        assert!(reasons.has_enabled_reason());
    }

    #[test]
    fn notification_reasons_require_one_enabled_value() {
        let none = NotificationReasonSettings {
            overdue: false,
            due_today: false,
            follow_up: false,
            needs_check: false,
        };
        let one = NotificationReasonSettings {
            overdue: true,
            due_today: false,
            follow_up: false,
            needs_check: false,
        };
        assert!(!none.has_enabled_reason());
        assert!(one.has_enabled_reason());
    }
}
