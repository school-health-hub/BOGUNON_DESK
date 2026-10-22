use std::{marker::PhantomData, rc::Rc};

use windows::{
    core::{w, Error, Result},
    Win32::{
        Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM},
        System::LibraryLoader::GetModuleHandleW,
        UI::WindowsAndMessaging::{
            CreateWindowExW, DefWindowProcW, DestroyWindow, RegisterClassW, UnregisterClassW,
            CS_HREDRAW, CS_VREDRAW, CW_USEDEFAULT, WINDOW_EX_STYLE, WINDOW_STYLE, WNDCLASSW,
            WS_OVERLAPPEDWINDOW,
        },
    },
};

const CLASS_NAME: windows::core::PCWSTR = w!("BogunonDesktopSurfaceHost");

pub struct OwnedWindow {
    hwnd: HWND,
    instance: HINSTANCE,
    class_registered: bool,
    _creator_thread: PhantomData<Rc<()>>,
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
            class_registered: true,
            _creator_thread: PhantomData,
        })
    }

    /// Confirm teardown results instead of treating dispatch/Drop as proof.
    pub fn destroy(mut self) -> Result<()> {
        // SAFETY: this !Send wrapper owns the HWND on the current creator thread.
        unsafe { DestroyWindow(self.hwnd) }?;
        self.hwnd = HWND::default();
        // SAFETY: the owned window is gone and this instance registered the class.
        unsafe { UnregisterClassW(CLASS_NAME, Some(self.instance)) }?;
        self.class_registered = false;
        Ok(())
    }

    pub fn hwnd(&self) -> HWND {
        self.hwnd
    }
}

impl Drop for OwnedWindow {
    fn drop(&mut self) {
        if !self.hwnd.is_invalid() {
            // SAFETY: OwnedWindow is !Send, so its creator thread destroys its owned HWND once.
            let _ = unsafe { DestroyWindow(self.hwnd) };
            self.hwnd = HWND::default();
        }
        if self.class_registered {
            // SAFETY: the class was registered by this instance and no owned window remains.
            let _ = unsafe { UnregisterClassW(CLASS_NAME, Some(self.instance)) };
            self.class_registered = false;
        }
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
