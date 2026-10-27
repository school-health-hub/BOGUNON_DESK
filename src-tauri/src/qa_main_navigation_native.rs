//! COM interfaces stay on Tauri's owning UI thread; only tokens/primitives cross it.
use super::{Bootstrap, Failure, Tokens};
use std::sync::{Arc, Mutex};
use tauri::WebviewWindow;
use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2;
use webview2_com::{NavigationCompletedEventHandler, NavigationStartingEventHandler};
use windows::core::BOOL;

pub(super) fn attach(main: &WebviewWindow, bootstrap: Arc<Bootstrap>) -> Result<(), Failure> {
    let result = Arc::new(Mutex::new(None));
    let observed = Arc::clone(&result);
    let captured = main.clone();
    main.with_webview(move |platform| {
        // SAFETY: [Category 8 — FFI] Tauri supplies a live controller on its UI
        // apartment. The returned interface owns its COM reference on this thread.
        let outcome = unsafe { platform.controller().CoreWebView2() }
            .map_err(|_| Failure::SubscribeFailed)
            .and_then(|core| subscribe(&core, &captured, bootstrap));
        if let Ok(mut observed) = observed.lock() {
            *observed = Some(outcome);
        }
    })
    .map_err(|_| Failure::SubscribeFailed)?;
    // Pinned Tauri executes with_webview inline on its UI thread. If that
    // guarantee changes, do NOT start navigation without observed registration.
    let outcome = result
        .lock()
        .map_err(|_| Failure::SubscribeFailed)?
        .take()
        .ok_or(Failure::SubscribeFailed)?;
    outcome
}

fn subscribe(
    core: &ICoreWebView2,
    main: &WebviewWindow,
    bootstrap: Arc<Bootstrap>,
) -> Result<(), Failure> {
    if !bootstrap
        .gate
        .lock()
        .map_err(|_| Failure::SubscribeFailed)?
        .waiting()
    {
        return Err(Failure::SubscribeFailed);
    }
    let start_state = Arc::clone(&bootstrap);
    let start_main = main.clone();
    let starting = NavigationStartingEventHandler::create(Box::new(move |sender, args| {
        let mut id = 0;
        let valid = match (sender, args) {
            (Some(_), Some(args)) => {
                // SAFETY: [Category 8 — FFI] callback args live for this call;
                // id is initialized writable u64 storage copied before return.
                unsafe { args.NavigationId(&mut id) }.is_ok()
            }
            _ => false,
        };
        if valid {
            start_state.observe_started(&start_main, id);
        } else {
            start_state.fail(&start_main, Failure::NavigationFailed);
        }
        Ok(())
    }));
    let done_state = Arc::clone(&bootstrap);
    let done_main = main.clone();
    let completed = NavigationCompletedEventHandler::create(Box::new(move |sender, args| {
        let mut success = BOOL::default();
        let mut id = 0;
        let valid = match (sender, args) {
            (Some(_), Some(args)) => {
                // SAFETY: [Category 8 — FFI] live callback args, initialized
                // BOOL/u64 out-parameters; no borrowed COM data escapes.
                unsafe {
                    args.IsSuccess(&mut success)
                        .and_then(|_| args.NavigationId(&mut id))
                }
                .is_ok()
            }
            _ => false,
        };
        if valid {
            done_state.observe_completed(&done_main, id, success.as_bool());
        } else {
            done_state.fail(&done_main, Failure::NavigationFailed);
        }
        Ok(())
    }));
    let mut token = 0;
    let mut tokens = bootstrap
        .tokens
        .lock()
        .map_err(|_| Failure::SubscribeFailed)?;
    // SAFETY: [Category 8 — FFI] reference-counted callback and writable token;
    // record ownership immediately after each successful registration.
    unsafe { core.add_NavigationStarting(&starting, &mut token) }
        .map_err(|_| Failure::SubscribeFailed)?;
    tokens.starting = Some(token);
    // SAFETY: [Category 8 — FFI] same live core and callback ownership contract.
    unsafe { core.add_NavigationCompleted(&completed, &mut token) }
        .map_err(|_| Failure::SubscribeFailed)?;
    tokens.completed = Some(token);
    Ok(())
}

pub(super) fn detach(core: &ICoreWebView2, bootstrap: &Bootstrap) -> Result<(), Failure> {
    let Tokens {
        starting,
        completed,
    } = std::mem::take(
        &mut *bootstrap
            .tokens
            .lock()
            .map_err(|_| Failure::UnsubscribeFailed)?,
    );
    let mut failed = false;
    if let Some(token) = starting {
        // SAFETY: [Category 8 — FFI] same captured WebView on owning UI thread;
        // token was acquired once and consumed once, including partial attach.
        failed |= unsafe { core.remove_NavigationStarting(token) }.is_err();
    }
    if let Some(token) = completed {
        // SAFETY: [Category 8 — FFI] same one-shot token ownership as above.
        failed |= unsafe { core.remove_NavigationCompleted(token) }.is_err();
    }
    if failed {
        Err(Failure::UnsubscribeFailed)
    } else {
        Ok(())
    }
}

pub(super) fn detach_completed(core: &ICoreWebView2, bootstrap: &Bootstrap) -> Result<(), Failure> {
    let token = bootstrap
        .tokens
        .lock()
        .map_err(|_| Failure::UnsubscribeFailed)?
        .completed
        .take();
    if let Some(token) = token {
        // SAFETY: [Category 8 — FFI] owning UI apartment, acquired token consumed
        // once; keep NavigationStarting subscribed through URL/identity validation.
        unsafe { core.remove_NavigationCompleted(token) }
            .map_err(|_| Failure::UnsubscribeFailed)?;
    }
    Ok(())
}

pub(super) fn detach_now(main: &WebviewWindow, bootstrap: Arc<Bootstrap>) -> Result<(), Failure> {
    let result = Arc::new(Mutex::new(None));
    let observed = Arc::clone(&result);
    main.with_webview(move |platform| {
        // SAFETY: [Category 8 — FFI] controller and returned core stay on the
        // Tauri UI apartment. No interface reference crosses threads.
        let outcome = unsafe { platform.controller().CoreWebView2() }
            .map_err(|_| Failure::UnsubscribeFailed)
            .and_then(|core| detach(&core, &bootstrap));
        if let Ok(mut observed) = observed.lock() {
            *observed = Some(outcome);
        }
    })
    .map_err(|_| Failure::UnsubscribeFailed)?;
    let outcome = result
        .lock()
        .map_err(|_| Failure::UnsubscribeFailed)?
        .take()
        .ok_or(Failure::UnsubscribeFailed)?;
    outcome
}
