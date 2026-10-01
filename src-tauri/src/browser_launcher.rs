use std::{
    env,
    ffi::OsString,
    path::{Path, PathBuf},
    process::Command,
};

use tauri::{AppHandle, Url};
use tauri_plugin_opener::OpenerExt;

struct BrowserOpeners<C, D> {
    chrome: C,
    default: D,
}

fn parse_web_url(input: &str) -> Result<Url, String> {
    let url = Url::parse(input.trim())
        .map_err(|_| "http 또는 https 주소만 열 수 있습니다.".to_owned())?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("http 또는 https 주소만 열 수 있습니다.".to_owned());
    }
    Ok(url)
}

fn chrome_executable_with<G, E>(get_env: G, exists: E) -> Option<PathBuf>
where
    G: Fn(&str) -> Option<OsString>,
    E: Fn(&Path) -> bool,
{
    ["PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"]
        .into_iter()
        .filter_map(get_env)
        .map(PathBuf::from)
        .map(|base| {
            base.join("Google")
                .join("Chrome")
                .join("Application")
                .join("chrome.exe")
        })
        .find(|path| exists(path))
}

fn chrome_executable() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        chrome_executable_with(|key| env::var_os(key), |path| path.exists())
    }
    #[cfg(not(windows))]
    {
        None
    }
}

fn open_with<C, D>(
    input: &str,
    chrome: Option<PathBuf>,
    openers: BrowserOpeners<C, D>,
) -> Result<(), String>
where
    C: FnOnce(PathBuf, String) -> Result<(), String>,
    D: FnOnce(String) -> Result<(), String>,
{
    let url = parse_web_url(input)?.to_string();
    if let Some(path) = chrome {
        if (openers.chrome)(path, url.clone()).is_ok() {
            return Ok(());
        }
    }
    (openers.default)(url)
}

pub(crate) fn open_url(app: &AppHandle, url: &str) -> Result<(), String> {
    let chrome = chrome_executable();
    open_with(
        url,
        chrome,
        BrowserOpeners {
            chrome: |path, target| {
                Command::new(path)
                    .arg(target)
                    .spawn()
                    .map(|_| ())
                    .map_err(|error| error.to_string())
            },
            default: |target| {
                app.opener()
                    .open_url(target, None::<&str>)
                    .map_err(|error| error.to_string())
            },
        },
    )
}

#[cfg(test)]
#[path = "browser_launcher_tests.rs"]
mod tests;
