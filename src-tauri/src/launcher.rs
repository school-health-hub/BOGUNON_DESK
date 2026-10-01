use std::{
    fmt,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Url};
use tauri_plugin_store::StoreExt;

use crate::browser_launcher;

const STORE_FILE: &str = "desktop-launchers.json";
const ONLINE_HEALTH_ROOM_KEY: &str = "onlineHealthRoomUrl";
const BOGUNON_KEY: &str = "bogunonUrl";
const CHECKUP_TOOL_KEY: &str = "checkupToolUrl";
const WORK_PORTAL_KEY: &str = "workPortalUrl";
const WORK_PORTAL_AUTO_OPEN_DELAY_KEY: &str = "workPortalAutoOpenDelay";
const BOGUNON_AED_ROUTE: &str = "/aed";
const BOGUNON_AI_WRITER_ROUTE: &str = "/ai-writer";
const BOGUNON_SCHOOL_SETTINGS_ROUTE: &str = "/settings#school-information";
const BOGUNON_AUTHENTICATED_ORIGIN: &str = "https://bogunon.vercel.app";

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherSettings {
    online_health_room_url: Option<String>,
    bogunon_url: Option<String>,
    checkup_tool_url: Option<String>,
    work_portal_url: Option<String>,
    work_portal_auto_open_delay: WorkPortalAutoOpenDelay,
}

#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Eq, Serialize)]
pub enum WorkPortalAutoOpenDelay {
    #[default]
    #[serde(rename = "off")]
    Off,
    #[serde(rename = "20s")]
    After20Seconds,
    #[serde(rename = "45s")]
    After45Seconds,
}

impl WorkPortalAutoOpenDelay {
    fn from_stored(value: Option<&str>) -> Self {
        match value {
            Some("20s") => Self::After20Seconds,
            Some("45s") => Self::After45Seconds,
            Some("off") | None | Some(_) => Self::Off,
        }
    }

    const fn as_str(self) -> &'static str {
        match self {
            Self::Off => "off",
            Self::After20Seconds => "20s",
            Self::After45Seconds => "45s",
        }
    }

    const fn seconds(self) -> Option<u64> {
        match self {
            Self::Off => None,
            Self::After20Seconds => Some(20),
            Self::After45Seconds => Some(45),
        }
    }
}

#[derive(Default)]
pub struct WorkPortalAutoOpenState {
    scheduled: AtomicBool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountLauncherLinks {
    online_health_room_url: Option<String>,
    bogunon_url: Option<String>,
    checkup_tool_url: Option<String>,
}

#[derive(Debug)]
enum LauncherError {
    InvalidUrl,
    InvalidSearchResult,
    UnsupportedAction,
    Plugin(String),
}

impl fmt::Display for LauncherError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidUrl => formatter.write_str("http 또는 https 주소를 입력해 주세요."),
            Self::InvalidSearchResult => formatter.write_str("BOGUNON 검색 결과를 열 수 없습니다."),
            Self::UnsupportedAction => {
                formatter.write_str("URL을 설정할 수 없는 Desktop action입니다.")
            }
            Self::Plugin(message) => formatter.write_str(message),
        }
    }
}

fn store_string(app: &AppHandle, key: &str) -> Result<Option<String>, LauncherError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|error| LauncherError::Plugin(error.to_string()))?;
    Ok(store
        .get(key)
        .and_then(|value| value.as_str().map(str::to_owned)))
}

fn parse_web_url(input: &str) -> Result<Url, LauncherError> {
    let url = Url::parse(input.trim()).map_err(|_| LauncherError::InvalidUrl)?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err(LauncherError::InvalidUrl);
    }
    Ok(url)
}

pub(crate) fn build_bogunon_authenticated_api_url(
    configured_url: Option<&str>,
    route: &str,
) -> Result<Url, String> {
    let configured_url = configured_url.ok_or_else(|| "BOGUNON 연결이 필요합니다.".to_owned())?;
    let parsed =
        Url::parse(configured_url).map_err(|_| "BOGUNON 주소가 올바르지 않습니다.".to_owned())?;
    if parsed.scheme() != "https"
        || parsed.origin().ascii_serialization() != BOGUNON_AUTHENTICATED_ORIGIN
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("인증된 BOGUNON 주소가 아닙니다.".to_owned());
    }
    Url::parse(BOGUNON_AUTHENTICATED_ORIGIN)
        .and_then(|origin| origin.join(route))
        .map_err(|_| "BOGUNON 주소가 올바르지 않습니다.".to_owned())
}

fn resolve_quick_memo_url(input: &str) -> Result<String, LauncherError> {
    parse_web_url(input).map(|url| url.to_string())
}

fn execute_quick_memo_url<F>(input: &str, opener: F) -> Result<(), String>
where
    F: FnOnce(String) -> Result<(), String>,
{
    let url = resolve_quick_memo_url(input).map_err(|error| error.to_string())?;
    opener(url)
}

#[tauri::command]
pub fn open_quick_memo_url(app: AppHandle, url: String) -> Result<(), String> {
    execute_quick_memo_url(&url, |target| browser_launcher::open_url(&app, &target))
}

fn build_bogunon_url(base_url: &str, route: &str) -> Result<Url, LauncherError> {
    parse_web_url(base_url)?
        .join(route)
        .map_err(|_| LauncherError::InvalidUrl)
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BogunonSearchResultKind {
    Task,
    Event,
}

fn is_valid_calendar_date(value: &str) -> bool {
    let mut parts = value.split('-');
    let (Some(year), Some(month), Some(day), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return false;
    };
    let (Ok(year), Ok(month), Ok(day)) = (
        year.parse::<i32>(),
        month.parse::<u32>(),
        day.parse::<u32>(),
    ) else {
        return false;
    };
    let leap_year = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let max_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap_year => 29,
        2 => 28,
        _ => return false,
    };
    (1..=max_day).contains(&day)
}

fn is_safe_result_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn build_bogunon_search_result_url(
    base_url: &str,
    kind: BogunonSearchResultKind,
    id: &str,
    date: Option<&str>,
) -> Result<Url, LauncherError> {
    if !is_safe_result_id(id) || date.is_some_and(|value| !is_valid_calendar_date(value)) {
        return Err(LauncherError::InvalidSearchResult);
    }
    match (kind, date) {
        (BogunonSearchResultKind::Task, None) => build_bogunon_url(base_url, "/tasks"),
        (BogunonSearchResultKind::Task, Some(date))
        | (BogunonSearchResultKind::Event, Some(date)) => {
            let mut url = build_bogunon_url(base_url, "/calendar")?;
            let prefix = match kind {
                BogunonSearchResultKind::Task => "task",
                BogunonSearchResultKind::Event => "event",
            };
            url.query_pairs_mut()
                .append_pair("date", date)
                .append_pair("highlight", &format!("{prefix}:{id}"));
            Ok(url)
        }
        (BogunonSearchResultKind::Event, None) => Err(LauncherError::InvalidSearchResult),
    }
}

fn resolve_bogunon_search_result_target(
    base_url: Option<&str>,
    kind: BogunonSearchResultKind,
    id: &str,
    date: Option<&str>,
) -> Result<Option<Url>, LauncherError> {
    base_url
        .map(|base_url| build_bogunon_search_result_url(base_url, kind, id, date))
        .transpose()
}

pub fn open_bogunon_search_result(
    app: &AppHandle,
    kind: BogunonSearchResultKind,
    id: &str,
    date: Option<&str>,
) -> Result<Option<&'static str>, String> {
    let base_url = valid_stored_url(app, BOGUNON_KEY).map_err(|error| error.to_string())?;
    let Some(url) = resolve_bogunon_search_result_target(base_url.as_deref(), kind, id, date)
        .map_err(|error| error.to_string())?
    else {
        return Ok(Some("BOGUNON 주소가 아직 설정되지 않았습니다."));
    };
    browser_launcher::open_url(app, url.as_str())?;
    Ok(None)
}

fn valid_stored_url(app: &AppHandle, key: &str) -> Result<Option<String>, LauncherError> {
    store_string(app, key)?.map_or(Ok(None), |value| {
        parse_web_url(&value).map(|url| Some(url.to_string()))
    })
}

pub(crate) fn bogunon_url(app: &AppHandle) -> Result<Option<String>, String> {
    valid_stored_url(app, BOGUNON_KEY).map_err(|error| error.to_string())
}

fn load_settings(app: &AppHandle) -> Result<LauncherSettings, LauncherError> {
    let auto_open_delay = store_string(app, WORK_PORTAL_AUTO_OPEN_DELAY_KEY)?;
    Ok(LauncherSettings {
        online_health_room_url: valid_stored_url(app, ONLINE_HEALTH_ROOM_KEY)?,
        bogunon_url: valid_stored_url(app, BOGUNON_KEY)?,
        checkup_tool_url: valid_stored_url(app, CHECKUP_TOOL_KEY)?,
        work_portal_url: store_string(app, WORK_PORTAL_KEY)?
            .and_then(|value| parse_web_url(&value).ok().map(|url| url.to_string())),
        work_portal_auto_open_delay: WorkPortalAutoOpenDelay::from_stored(
            auto_open_delay.as_deref(),
        ),
    })
}

fn save_string(app: &AppHandle, key: &str, value: &str) -> Result<(), LauncherError> {
    let store = app
        .store(STORE_FILE)
        .map_err(|error| LauncherError::Plugin(error.to_string()))?;
    store.set(key, serde_json::Value::String(value.to_owned()));
    store
        .save()
        .map_err(|error| LauncherError::Plugin(error.to_string()))
}

fn normalize_optional_url(value: Option<String>) -> Result<Option<String>, LauncherError> {
    value
        .map(|url| parse_web_url(&url).map(|parsed| parsed.to_string()))
        .transpose()
}

#[derive(Debug, PartialEq)]
enum WorkPortalTarget {
    Ready(String),
    Unavailable(&'static str),
}

fn resolve_work_portal_target(value: Option<&str>) -> WorkPortalTarget {
    let Some(value) = value else {
        return WorkPortalTarget::Unavailable("업무포털 주소가 아직 설정되지 않았습니다.");
    };
    match parse_web_url(value) {
        Ok(url) => WorkPortalTarget::Ready(url.to_string()),
        Err(_) => WorkPortalTarget::Unavailable("저장된 업무포털 주소를 사용할 수 없습니다."),
    }
}

fn execute_work_portal_target<F>(
    target: WorkPortalTarget,
    opener: F,
) -> Result<Option<&'static str>, String>
where
    F: FnOnce(String) -> Result<(), String>,
{
    match target {
        WorkPortalTarget::Ready(url) => {
            opener(url)?;
            Ok(None)
        }
        WorkPortalTarget::Unavailable(message) => Ok(Some(message)),
    }
}

pub fn open_work_portal(app: &AppHandle) -> Result<Option<&'static str>, String> {
    let target = resolve_work_portal_target(
        store_string(app, WORK_PORTAL_KEY)
            .map_err(|error| error.to_string())?
            .as_deref(),
    );
    execute_work_portal_target(target, |url| browser_launcher::open_url(app, &url))
}

fn reserve_work_portal_auto_open(
    state: &WorkPortalAutoOpenState,
    delay: WorkPortalAutoOpenDelay,
    url: Option<&str>,
) -> Option<u64> {
    let seconds = delay.seconds()?;
    if !matches!(resolve_work_portal_target(url), WorkPortalTarget::Ready(_)) {
        return None;
    }
    state
        .scheduled
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .ok()
        .map(|_| seconds)
}

pub fn schedule_work_portal_auto_open(
    app: &AppHandle,
    state: &WorkPortalAutoOpenState,
) -> Result<bool, String> {
    let stored_delay =
        store_string(app, WORK_PORTAL_AUTO_OPEN_DELAY_KEY).map_err(|error| error.to_string())?;
    let stored_url = store_string(app, WORK_PORTAL_KEY).map_err(|error| error.to_string())?;
    let delay = WorkPortalAutoOpenDelay::from_stored(stored_delay.as_deref());
    let Some(seconds) = reserve_work_portal_auto_open(state, delay, stored_url.as_deref()) else {
        return Ok(false);
    };

    let app_handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        std::thread::sleep(Duration::from_secs(seconds));
        let _ = open_work_portal(&app_handle);
    });
    Ok(true)
}

#[tauri::command]
pub fn save_work_portal_url(
    app: AppHandle,
    url: Option<String>,
) -> Result<LauncherSettings, String> {
    let normalized = normalize_optional_url(url).map_err(|error| error.to_string())?;
    let store = app
        .store(STORE_FILE)
        .map_err(|error| LauncherError::Plugin(error.to_string()).to_string())?;
    match normalized {
        Some(url) => store.set(WORK_PORTAL_KEY, serde_json::Value::String(url)),
        None => {
            store.delete(WORK_PORTAL_KEY);
        }
    }
    store.save().map_err(|error| error.to_string())?;
    load_settings(&app).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_work_portal_auto_open_delay(
    app: AppHandle,
    delay: WorkPortalAutoOpenDelay,
) -> Result<LauncherSettings, String> {
    save_string(&app, WORK_PORTAL_AUTO_OPEN_DELAY_KEY, delay.as_str())
        .map_err(|error| error.to_string())?;
    load_settings(&app).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn replace_account_launcher_links(
    app: AppHandle,
    launcher_links: AccountLauncherLinks,
) -> Result<LauncherSettings, String> {
    let values = [
        (
            ONLINE_HEALTH_ROOM_KEY,
            normalize_optional_url(launcher_links.online_health_room_url),
        ),
        (
            BOGUNON_KEY,
            normalize_optional_url(launcher_links.bogunon_url),
        ),
        (
            CHECKUP_TOOL_KEY,
            normalize_optional_url(launcher_links.checkup_tool_url),
        ),
    ];
    let normalized = values
        .into_iter()
        .map(|(key, value)| value.map(|url| (key, url)))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    let store = app
        .store(STORE_FILE)
        .map_err(|error| LauncherError::Plugin(error.to_string()).to_string())?;
    for (key, value) in normalized {
        match value {
            Some(url) => store.set(key, serde_json::Value::String(url)),
            None => {
                store.delete(key);
            }
        }
    }
    store.save().map_err(|error| error.to_string())?;
    load_settings(&app).map_err(|error| error.to_string())
}

pub fn open_registered_url(
    app: &AppHandle,
    action_id: &str,
) -> Result<Option<&'static str>, String> {
    let (key, unavailable_message, route) = match action_id {
        "online-health-room" => (
            ONLINE_HEALTH_ROOM_KEY,
            "온라인 보건실 주소가 아직 설정되지 않았습니다.",
            None,
        ),
        "bogunon" => (
            BOGUNON_KEY,
            "BOGUNON 주소가 아직 설정되지 않았습니다.",
            None,
        ),
        "aed-check" => (
            BOGUNON_KEY,
            "BOGUNON이 아직 연결되지 않았습니다.",
            Some(BOGUNON_AED_ROUTE),
        ),
        "record-helper" => (
            BOGUNON_KEY,
            "BOGUNON이 아직 연결되지 않았습니다.",
            Some(BOGUNON_AI_WRITER_ROUTE),
        ),
        "bogunon-school-settings" => (
            BOGUNON_KEY,
            "BOGUNON이 아직 연결되지 않았습니다.",
            Some(BOGUNON_SCHOOL_SETTINGS_ROUTE),
        ),
        "checkup-tools" => (
            CHECKUP_TOOL_KEY,
            "이 도구는 아직 연결되지 않았습니다.",
            None,
        ),
        _ => return Err(LauncherError::UnsupportedAction.to_string()),
    };
    let Some(url) = valid_stored_url(app, key).map_err(|error| error.to_string())? else {
        return Ok(Some(unavailable_message));
    };
    let target_url = match route {
        Some(path) => build_bogunon_url(&url, path).map(|value| value.to_string()),
        None => Ok(url),
    };
    browser_launcher::open_url(app, &target_url.map_err(|error| error.to_string())?)?;
    Ok(None)
}

#[tauri::command]
pub fn get_launcher_settings(app: AppHandle) -> Result<LauncherSettings, String> {
    load_settings(&app).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_launcher_url(
    app: AppHandle,
    action_id: String,
    url: String,
) -> Result<LauncherSettings, String> {
    let key = match action_id.as_str() {
        "online-health-room" => ONLINE_HEALTH_ROOM_KEY,
        "bogunon" => BOGUNON_KEY,
        "checkup-tools" => CHECKUP_TOOL_KEY,
        _ => return Err(LauncherError::UnsupportedAction.to_string()),
    };
    let parsed = parse_web_url(&url).map_err(|error| error.to_string())?;
    save_string(&app, key, parsed.as_str()).map_err(|error| error.to_string())?;
    load_settings(&app).map_err(|error| error.to_string())
}

#[cfg(test)]
#[path = "launcher_tests.rs"]
mod tests;
