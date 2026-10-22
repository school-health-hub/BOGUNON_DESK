use std::{
    ffi::OsStr,
    os::windows::ffi::OsStrExt,
    path::{Path, PathBuf},
    sync::mpsc,
};
use thiserror::Error;
use webview2_com::{
    CoTaskMemPWSTR, CreateCoreWebView2ControllerCompletedHandler,
    CreateCoreWebView2EnvironmentCompletedHandler,
    Microsoft::Web::WebView2::Win32::{
        CreateCoreWebView2EnvironmentWithOptions, ICoreWebView2Controller,
        ICoreWebView2Environment, ICoreWebView2Environment7, ICoreWebView2EnvironmentOptions,
        ICoreWebView2_13,
    },
};
use windows::{
    core::{Interface, PCWSTR, PWSTR},
    Win32::{
        Foundation::HWND,
        System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED},
        UI::WindowsAndMessaging::{
            DispatchMessageW, GetMessageW, PeekMessageW, TranslateMessage, MSG, PM_REMOVE,
        },
    },
};

#[derive(Debug, Error)]
pub enum HostError {
    #[error("COM STA initialization failed: {0}")]
    Com(#[from] windows::core::Error),
    #[error("WebView2 creation callback was lost")]
    CallbackLost,
    #[error("WebView2 creation failed: {0}")]
    WebView(#[from] webview2_com::Error),
    #[error("Windows message loop failed")]
    MessageLoop,
    #[error("WebView2 returned a null result")]
    NullResult,
}

pub struct StaGuard(std::marker::PhantomData<std::rc::Rc<()>>);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RuntimeBinding {
    pub generation: u64,
    pub attempt: u64,
}

impl StaGuard {
    pub fn initialize() -> Result<Self, HostError> {
        // SAFETY: called once on the future host's creator thread before any COM object is created.
        unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }.ok()?;
        Ok(Self(std::marker::PhantomData))
    }
}

pub struct ControllerRequest {
    receiver: mpsc::Receiver<Result<BoundController, windows::core::Error>>,
    _creator_thread: std::marker::PhantomData<std::rc::Rc<()>>,
}

pub struct BoundController {
    pub binding: RuntimeBinding,
    pub controller: ICoreWebView2Controller,
}

impl ControllerRequest {
    pub fn begin(
        environment: &ICoreWebView2Environment,
        hwnd: HWND,
        binding: RuntimeBinding,
    ) -> Result<Self, HostError> {
        let (sender, receiver) = mpsc::channel();
        let handler = CreateCoreWebView2ControllerCompletedHandler::create(Box::new(
            move |result, controller| {
                result?;
                sender
                    .send(
                        controller
                            .map(|controller| BoundController {
                                binding,
                                controller,
                            })
                            .ok_or_else(windows::core::Error::from_win32),
                    )
                    .map_err(|_| windows::core::Error::from_win32())?;
                Ok(())
            },
        ));
        // SAFETY: hwnd is owned by the creator thread and the callback is reference-counted by
        // WebView2 for the asynchronous operation.
        unsafe { environment.CreateCoreWebView2Controller(hwnd, &handler) }?;
        Ok(Self {
            receiver,
            _creator_thread: std::marker::PhantomData,
        })
    }

    pub fn try_complete(&self) -> Result<Option<BoundController>, HostError> {
        match self.receiver.try_recv() {
            Ok(result) => result.map(Some).map_err(HostError::Com),
            Err(mpsc::TryRecvError::Empty) => Ok(None),
            Err(mpsc::TryRecvError::Disconnected) => Err(HostError::CallbackLost),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeObservation {
    pub effective_udf: PathBuf,
    pub profile_path: PathBuf,
    pub browser_process_id: u32,
}

pub fn observe_runtime(
    environment: &ICoreWebView2Environment,
    controller: &ICoreWebView2Controller,
) -> Result<RuntimeObservation, HostError> {
    let environment7: ICoreWebView2Environment7 = environment.cast()?;
    let mut udf = PWSTR::null();
    // SAFETY: udf points to writable pointer storage; WebView2 returns CoTaskMem-owned text.
    unsafe { environment7.UserDataFolder(&mut udf) }?;
    let effective_udf = PathBuf::from(CoTaskMemPWSTR::from(udf).to_string());

    // SAFETY: controller is a completed WebView2 controller from the same environment.
    let webview = unsafe { controller.CoreWebView2() }?;
    let mut browser_process_id = 0;
    // SAFETY: browser_process_id points to initialized writable storage.
    unsafe { webview.BrowserProcessId(&mut browser_process_id) }?;
    let webview13: ICoreWebView2_13 = webview.cast()?;
    // SAFETY: webview13 is queried from the live WebView2 instance.
    let profile = unsafe { webview13.Profile() }?;
    let mut profile_path = PWSTR::null();
    // SAFETY: profile_path points to writable pointer storage; WebView2 returns CoTaskMem text.
    unsafe { profile.ProfilePath(&mut profile_path) }?;

    Ok(RuntimeObservation {
        effective_udf,
        profile_path: PathBuf::from(CoTaskMemPWSTR::from(profile_path).to_string()),
        browser_process_id,
    })
}

impl Drop for StaGuard {
    fn drop(&mut self) {
        // SAFETY: StaGuard is !Send and is dropped on the thread that successfully initialized COM.
        unsafe { CoUninitialize() };
    }
}

pub struct EnvironmentRequest {
    receiver: mpsc::Receiver<Result<BoundEnvironment, windows::core::Error>>,
    _creator_thread: std::marker::PhantomData<std::rc::Rc<()>>,
}

pub struct BoundEnvironment {
    pub binding: RuntimeBinding,
    pub environment: ICoreWebView2Environment,
}

impl EnvironmentRequest {
    pub fn begin(
        _sta: &StaGuard,
        requested_udf: &Path,
        binding: RuntimeBinding,
    ) -> Result<Self, HostError> {
        let udf = wide(requested_udf.as_os_str());
        let (sender, receiver) = mpsc::channel();
        let handler = CreateCoreWebView2EnvironmentCompletedHandler::create(Box::new(
            move |result, environment| {
                result?;
                sender
                    .send(
                        environment
                            .map(|environment| BoundEnvironment {
                                binding,
                                environment,
                            })
                            .ok_or_else(windows::core::Error::from_win32),
                    )
                    .map_err(|_| windows::core::Error::from_win32())?;
                Ok(())
            },
        ));
        // SAFETY: pointers refer to NUL-terminated UTF-16 data for the duration of this call;
        // the callback object is reference-counted by the WebView2 API.
        unsafe {
            CreateCoreWebView2EnvironmentWithOptions(
                PCWSTR::null(),
                PCWSTR(udf.as_ptr()),
                None::<&ICoreWebView2EnvironmentOptions>,
                &handler,
            )
        }?;
        Ok(Self {
            receiver,
            _creator_thread: std::marker::PhantomData,
        })
    }

    pub fn try_complete(&self) -> Result<Option<BoundEnvironment>, HostError> {
        match self.receiver.try_recv() {
            Ok(result) => result.map(Some).map_err(HostError::Com),
            Err(mpsc::TryRecvError::Empty) => Ok(None),
            Err(mpsc::TryRecvError::Disconnected) => Err(HostError::CallbackLost),
        }
    }
}

pub fn pump_once() -> Result<bool, HostError> {
    let mut message = MSG::default();
    // SAFETY: message points to initialized writable storage; HWND filter is intentionally unrestricted.
    let result = unsafe { GetMessageW(&mut message, None, 0, 0) }.0;
    match result {
        -1 => Err(HostError::MessageLoop),
        0 => Ok(false),
        _ => {
            // SAFETY: message was populated by a successful GetMessageW call on this thread.
            unsafe {
                let _ = TranslateMessage(&message);
                DispatchMessageW(&message);
            }
            Ok(true)
        }
    }
}

pub fn pump_pending() -> Result<usize, HostError> {
    let mut count = 0;
    loop {
        let mut message = MSG::default();
        // SAFETY: message is writable stack storage and PM_REMOVE transfers one queued message.
        let present = unsafe { PeekMessageW(&mut message, None, 0, 0, PM_REMOVE) }.as_bool();
        if !present {
            return Ok(count);
        }
        // SAFETY: PeekMessageW populated message and it is dispatched on the owning UI thread.
        unsafe {
            let _ = TranslateMessage(&message);
            DispatchMessageW(&message);
        }
        count += 1;
    }
}

fn wide(value: &OsStr) -> Vec<u16> {
    value.encode_wide().chain(std::iter::once(0)).collect()
}
