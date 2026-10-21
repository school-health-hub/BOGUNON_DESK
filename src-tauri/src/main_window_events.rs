//! Main-only global window policy; no secondary window is created.
use crate::{main_events, main_lifetime, purchase_helper, DesktopState};
use std::sync::atomic::Ordering;
use tauri::{Manager, Window, WindowEvent};
pub(crate) fn handle(window: &Window, event: &WindowEvent) {
    let boundary = window.state::<main_events::MainEvents>();
    if let WindowEvent::Destroyed = event {
        main_lifetime::retire(window);
        boundary.retire_window(window);
        return;
    }
    if !boundary.is_main_window(window) {
        return;
    }
    match event {
        WindowEvent::CloseRequested { api, .. } => {
            let state = window.state::<DesktopState>();
            let input = main_events::WindowInput::Close {
                close_to_tray: state.close_to_tray.load(Ordering::SeqCst),
                quitting: state.quitting.load(Ordering::SeqCst),
            };
            if boundary.window_action(window, input) == main_events::Action::HideMain {
                api.prevent_close();
                let _ = window.hide();
            }
        }
        WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) => {
            let Ok(lease) = boundary.capture(window.app_handle()) else {
                return;
            };
            let state = window.state::<purchase_helper::PurchaseHelperState>();
            let input = main_events::WindowInput::Drop {
                purchase_active: state.is_active(),
            };
            match boundary.window_action(window, input) {
                main_events::Action::AnalyzeDrop => {
                    let generation = state.begin_analysis();
                    if lease
                        .emit(
                            window.app_handle(),
                            main_events::BusinessEvent::AnalysisStart,
                            generation,
                        )
                        .is_err()
                    {
                        return;
                    }
                    let paths = paths.clone();
                    let templates = state.templates();
                    let app = window.app_handle().clone();
                    tauri::async_runtime::spawn(async move {
                        let analysis =
                            purchase_helper::analyze_paths_in_background(paths, templates).await;
                        let state = app.state::<purchase_helper::PurchaseHelperState>();
                        purchase_helper::deliver_analysis(
                            &app, &lease, &state, generation, analysis,
                        );
                    });
                }
                main_events::Action::ForwardDrop => {
                    let paths = paths
                        .iter()
                        .filter_map(|path| path.to_str().map(str::to_owned))
                        .collect::<Vec<_>>();
                    if !paths.is_empty() {
                        let _ = lease.emit(
                            window.app_handle(),
                            main_events::BusinessEvent::FileDrop,
                            paths,
                        );
                    }
                }
                _ => {}
            }
        }
        _ => {}
    }
}
