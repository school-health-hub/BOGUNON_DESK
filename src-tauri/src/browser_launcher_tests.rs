use super::{chrome_executable_with, open_with, BrowserOpeners};
use std::{cell::Cell, collections::HashMap, ffi::OsString, path::PathBuf};

#[test]
fn selects_the_first_existing_standard_chrome_location() {
    let values = HashMap::from([
        ("PROGRAMFILES", OsString::from("C:/Program Files")),
        (
            "LOCALAPPDATA",
            OsString::from("C:/Users/Test/AppData/Local"),
        ),
    ]);
    let expected =
        PathBuf::from("C:/Users/Test/AppData/Local/Google/Chrome/Application/chrome.exe");

    let selected = chrome_executable_with(|key| values.get(key).cloned(), |path| path == expected);

    assert_eq!(selected, Some(expected));
}

#[test]
fn uses_default_opener_when_chrome_is_not_installed() {
    let default_calls = Cell::new(0);

    let result = open_with(
        "https://example.com/health",
        None,
        BrowserOpeners {
            chrome: |_: PathBuf, _: String| Ok(()),
            default: |_| {
                default_calls.set(default_calls.get() + 1);
                Ok(())
            },
        },
    );

    assert_eq!(result, Ok(()));
    assert_eq!(default_calls.get(), 1);
}

#[test]
fn falls_back_when_chrome_launch_fails() {
    let default_calls = Cell::new(0);
    let chrome = PathBuf::from("C:/Program Files/Google/Chrome/Application/chrome.exe");

    let result = open_with(
        "https://example.com/health",
        Some(chrome),
        BrowserOpeners {
            chrome: |_, _| Err("launch failed".to_owned()),
            default: |_| {
                default_calls.set(default_calls.get() + 1);
                Ok(())
            },
        },
    );

    assert_eq!(result, Ok(()));
    assert_eq!(default_calls.get(), 1);
}

#[test]
fn rejects_invalid_urls_before_launching_any_browser() {
    let calls = Cell::new(0);

    let result = open_with(
        "file:///C:/private.txt",
        Some(PathBuf::from("chrome.exe")),
        BrowserOpeners {
            chrome: |_, _| {
                calls.set(calls.get() + 1);
                Ok(())
            },
            default: |_| {
                calls.set(calls.get() + 1);
                Ok(())
            },
        },
    );

    assert!(result.is_err());
    assert_eq!(calls.get(), 0);
}
