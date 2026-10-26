use std::{marker::PhantomData, rc::Rc};

use windows::{
    core::{w, Error, Result},
    Win32::{
        Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM},
        System::LibraryLoader::GetModuleHandleW,
        UI::WindowsAndMessaging::{
            CreateWindowExW, DefWindowProcW, DestroyWindow, RegisterClassW, ShowWindow,
            UnregisterClassW, CS_HREDRAW, CS_VREDRAW, CW_USEDEFAULT, SW_SHOW, WINDOW_EX_STYLE,
            WINDOW_STYLE, WNDCLASSW, WS_OVERLAPPEDWINDOW,
        },
    },
};

const CLASS_NAME: windows::core::PCWSTR = w!("BogunonDesktopSurfaceHost");

pub struct OwnedWindow {
    hwnd: HWND,
    instance: HINSTANCE,
    release: NativeReleaseState,
    _creator_thread: PhantomData<Rc<()>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct NativeReleaseState {
    window_owned: bool,
    class_owned: bool,
}

impl NativeReleaseState {
    const fn owned() -> Self {
        Self {
            window_owned: true,
            class_owned: true,
        }
    }

    #[cfg(test)]
    const fn window_owned(self) -> bool {
        self.window_owned
    }

    #[cfg(test)]
    const fn class_owned(self) -> bool {
        self.class_owned
    }
}

fn confirm_native_release<E>(
    state: &mut NativeReleaseState,
    destroy_window: impl FnOnce() -> std::result::Result<(), E>,
    unregister_class: impl FnOnce() -> std::result::Result<(), E>,
) -> std::result::Result<(), E> {
    if state.window_owned {
        destroy_window()?;
        state.window_owned = false;
    }
    if state.class_owned {
        unregister_class()?;
        state.class_owned = false;
    }
    Ok(())
}

impl OwnedWindow {
    pub fn create_hidden() -> Result<Self> {
        // SAFETY: a null module name asks for the executable module of this process.
        let module = unsafe { GetModuleHandleW(None) }?;
        let instance = HINSTANCE(module.0);
        let window_class = WNDCLASSW {
            style: CS_HREDRAW | CS_VREDRAW,
            lpfnWndProc: Some(window_proc),
            hInstance: instance,
            lpszClassName: CLASS_NAME,
            ..Default::default()
        };
        // SAFETY: window_class points to process-owned static class data and a valid window proc.
        let atom = unsafe { RegisterClassW(&window_class) };
        if atom == 0 {
            return Err(Error::from_win32());
        }

        // SAFETY: the registered class and module belong to this process; no borrowed creation data
        // is supplied. The window starts hidden because WS_VISIBLE is intentionally absent.
        let hwnd = unsafe {
            CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                CLASS_NAME,
                w!("BOGUNON DESK Desktop Surface"),
                WINDOW_STYLE(WS_OVERLAPPEDWINDOW.0),
                CW_USEDEFAULT,
                CW_USEDEFAULT,
                800,
                600,
                None,
                None,
                Some(instance),
                None,
            )
        }?;

        Ok(Self {
            hwnd,
            instance,
            release: NativeReleaseState::owned(),
            _creator_thread: PhantomData,
        })
    }

    /// Confirm teardown results instead of treating dispatch/Drop as proof.
    pub fn destroy(mut self) -> Result<()> {
        let hwnd = self.hwnd;
        let instance = self.instance;
        confirm_native_release(
            &mut self.release,
            || {
                // SAFETY: this !Send wrapper owns the HWND on the current creator thread.
                unsafe { DestroyWindow(hwnd) }
            },
            || {
                // SAFETY: the owned window was destroyed and this instance registered the class.
                unsafe { UnregisterClassW(CLASS_NAME, Some(instance)) }
            },
        )
    }

    pub fn hwnd(&self) -> HWND {
        self.hwnd
    }

    pub fn show(&self) -> Result<()> {
        // SAFETY: [Category 8 — FFI boundary] this !Send wrapper owns a live HWND on the
        // creator STA thread, and neither call retains borrowed Rust memory.
        let _ = unsafe { ShowWindow(self.hwnd, SW_SHOW) };
        Ok(())
    }
}

impl Drop for OwnedWindow {
    fn drop(&mut self) {
        let hwnd = self.hwnd;
        let instance = self.instance;
        let _ = confirm_native_release(
            &mut self.release,
            || {
                // SAFETY: OwnedWindow is !Send, so its creator thread destroys its owned HWND once.
                unsafe { DestroyWindow(hwnd) }
            },
            || {
                // SAFETY: the owned window is gone and this instance registered the class.
                unsafe { UnregisterClassW(CLASS_NAME, Some(instance)) }
            },
        );
    }
}

unsafe extern "system" fn window_proc(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    // SAFETY: all messages are forwarded unchanged to the system default procedure.
    unsafe { DefWindowProcW(hwnd, message, wparam, lparam) }
}

#[cfg(test)]
mod tests {
    use super::{confirm_native_release, NativeReleaseState};
    use std::cell::Cell;

    #[test]
    fn native_release_state_advances_only_after_each_confirmed_operation() {
        let mut state = NativeReleaseState::owned();
        let unregister_calls = Cell::new(0);

        let result = confirm_native_release(
            &mut state,
            || Err::<(), _>("destroy failed"),
            || {
                unregister_calls.set(unregister_calls.get() + 1);
                Ok(())
            },
        );

        assert_eq!(result, Err("destroy failed"));
        assert!(state.window_owned());
        assert!(state.class_owned());
        assert_eq!(unregister_calls.get(), 0);
    }

    #[test]
    fn partial_native_release_keeps_only_the_unconfirmed_class_owned() {
        let mut state = NativeReleaseState::owned();

        let result = confirm_native_release(
            &mut state,
            || Ok::<(), &str>(()),
            || Err("unregister failed"),
        );

        assert_eq!(result, Err("unregister failed"));
        assert!(!state.window_owned());
        assert!(state.class_owned());
    }

    #[test]
    fn confirmed_native_release_is_idempotent_at_the_internal_state_seam() {
        let mut state = NativeReleaseState::owned();
        let calls = Cell::new(0);
        let release = || {
            calls.set(calls.get() + 1);
            Ok::<(), &str>(())
        };

        assert_eq!(confirm_native_release(&mut state, release, release), Ok(()));
        assert_eq!(confirm_native_release(&mut state, release, release), Ok(()));
        assert_eq!(calls.get(), 2);
        assert!(!state.window_owned());
        assert!(!state.class_owned());
    }
}
