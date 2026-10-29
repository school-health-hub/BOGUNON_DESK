use serde::Serialize;
use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller;
use windows::{
    core::BOOL,
    Win32::{
        Foundation::{HWND, RECT},
        UI::WindowsAndMessaging::{GetClientRect, IsWindowVisible},
    },
};

use crate::windows_host::HostError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct GeometryRect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

impl GeometryRect {
    #[cfg(test)]
    const fn from_size(width: i32, height: i32) -> Self {
        Self {
            left: 0,
            top: 0,
            right: width,
            bottom: height,
        }
    }

    const fn width(self) -> i32 {
        self.right - self.left
    }

    const fn height(self) -> i32 {
        self.bottom - self.top
    }
}

impl From<RECT> for GeometryRect {
    fn from(value: RECT) -> Self {
        Self {
            left: value.left,
            top: value.top,
            right: value.right,
            bottom: value.bottom,
        }
    }
}

impl From<GeometryRect> for RECT {
    fn from(value: GeometryRect) -> Self {
        Self {
            left: value.left,
            top: value.top,
            right: value.right,
            bottom: value.bottom,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum GeometryStage {
    ControllerCreated,
    BoundsSynchronized,
    RendererReady,
    ControllerVisible,
    WindowVisible,
    WindowResized,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ControllerBounds {
    pub(crate) left: i32,
    pub(crate) top: i32,
    pub(crate) width: i32,
    pub(crate) height: i32,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WindowGeometryObservation {
    pub(crate) stage: GeometryStage,
    pub(crate) hwnd_client_width: i32,
    pub(crate) hwnd_client_height: i32,
    pub(crate) controller_bounds: ControllerBounds,
    pub(crate) controller_is_visible: bool,
    pub(crate) hwnd_is_visible: bool,
}

fn planned_bounds_update(client: GeometryRect, controller: GeometryRect) -> Option<GeometryRect> {
    if client.width() <= 0 || client.height() <= 0 || client == controller {
        None
    } else {
        Some(client)
    }
}

pub(crate) fn observe(
    hwnd: HWND,
    controller: &ICoreWebView2Controller,
    stage: GeometryStage,
) -> Result<WindowGeometryObservation, HostError> {
    let mut client = RECT::default();
    let mut controller_bounds = RECT::default();
    let mut controller_is_visible = BOOL::default();
    // SAFETY: [Category 8 — FFI boundary] hwnd and controller are live STA-owned handles;
    // all output pointers refer to initialized writable stack storage for these calls only.
    unsafe {
        GetClientRect(hwnd, &mut client)?;
        controller.Bounds(&mut controller_bounds)?;
        controller.IsVisible(&mut controller_is_visible)?;
    }
    let client = GeometryRect::from(client);
    let controller_bounds = GeometryRect::from(controller_bounds);
    Ok(WindowGeometryObservation {
        stage,
        hwnd_client_width: client.width(),
        hwnd_client_height: client.height(),
        controller_bounds: ControllerBounds {
            left: controller_bounds.left,
            top: controller_bounds.top,
            width: controller_bounds.width(),
            height: controller_bounds.height(),
        },
        controller_is_visible: controller_is_visible.as_bool(),
        // SAFETY: [Category 8 — FFI boundary] hwnd is a live window handle owned by this thread.
        hwnd_is_visible: unsafe { IsWindowVisible(hwnd) }.as_bool(),
    })
}

pub(crate) fn synchronize(
    hwnd: HWND,
    controller: &ICoreWebView2Controller,
) -> Result<(), HostError> {
    let mut client = RECT::default();
    let mut current = RECT::default();
    // SAFETY: [Category 8 — FFI boundary] hwnd and controller are live STA-owned handles;
    // the API copies RECT values synchronously and retains no Rust references.
    unsafe {
        GetClientRect(hwnd, &mut client)?;
        controller.Bounds(&mut current)?;
    }
    if let Some(desired) =
        planned_bounds_update(GeometryRect::from(client), GeometryRect::from(current))
    {
        // SAFETY: [Category 8 — FFI boundary] desired is a client-coordinate RECT copied by the
        // live controller on its creator STA. Zero-sized minimized client areas were rejected.
        unsafe { controller.SetBounds(desired.into()) }?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{planned_bounds_update, GeometryRect};

    #[test]
    fn plans_client_bounds_when_controller_bounds_are_empty() {
        let client = GeometryRect::from_size(784, 561);
        let controller = GeometryRect::from_size(0, 0);

        assert_eq!(planned_bounds_update(client, controller), Some(client));
    }

    #[test]
    fn skips_update_when_controller_already_matches_client() {
        let client = GeometryRect::from_size(784, 561);

        assert_eq!(planned_bounds_update(client, client), None);
    }

    #[test]
    fn skips_update_while_window_is_minimized_to_zero_client_area() {
        let minimized = GeometryRect::from_size(0, 0);
        let controller = GeometryRect::from_size(784, 561);

        assert_eq!(planned_bounds_update(minimized, controller), None);
    }
}
