use std::{
    cell::RefCell,
    ffi::OsStr,
    os::windows::ffi::OsStrExt,
    path::{Path, PathBuf},
    rc::Rc,
    sync::mpsc,
};
use thiserror::Error;
use webview2_com::{
    CoTaskMemPWSTR, CreateCoreWebView2ControllerCompletedHandler,
    CreateCoreWebView2EnvironmentCompletedHandler, ExecuteScriptCompletedHandler,
    FrameCreatedEventHandler,
    Microsoft::Web::WebView2::Win32::{
        CreateCoreWebView2EnvironmentWithOptions, ICoreWebView2, ICoreWebView2Controller,
        ICoreWebView2Environment, ICoreWebView2Environment7, ICoreWebView2EnvironmentOptions,
        ICoreWebView2_13, ICoreWebView2_2, ICoreWebView2_3, ICoreWebView2_4,
        COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY_CORS,
    },
    NavigationCompletedEventHandler, NavigationStartingEventHandler,
    NewWindowRequestedEventHandler, WebMessageReceivedEventHandler,
    WebResourceResponseReceivedEventHandler,
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

mod mapping_path;

use mapping_path::resolve_surface_bundle_mapping;

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
    #[error("surface bundle is unavailable or outside its canonical directory")]
    InvalidBundle,
    #[error("surface bundle path cannot be mapped by WebView2")]
    InvalidMappingPath,
    #[error("surface renderer session failed: {0}")]
    Renderer(#[from] crate::renderer_session::RendererSessionError),
    #[error("QA runtime diagnostic failed: {0}")]
    Diagnostic(#[from] crate::diagnostic::DiagnosticWriteError),
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
    pump_pending_bounded(|| true)
}

pub fn pump_pending_bounded(admitted: impl FnMut() -> bool) -> Result<usize, HostError> {
    crate::runtime_budget::pump_messages(64, admitted, || {
        let mut message = MSG::default();
        // SAFETY: message is writable stack storage and PM_REMOVE transfers one queued message.
        let present = unsafe { PeekMessageW(&mut message, None, 0, 0, PM_REMOVE) }.as_bool();
        if !present {
            return Ok(false);
        }
        // SAFETY: PeekMessageW populated message and dispatch stays on the owning UI thread.
        unsafe {
            let _ = TranslateMessage(&message);
            DispatchMessageW(&message);
        }
        Ok(true)
    })
}

fn wide(value: &OsStr) -> Vec<u16> {
    value.encode_wide().chain(std::iter::once(0)).collect()
}

use crate::{
    ipc::Generation,
    lifecycle::Attempt,
    ownership::Ledger,
    renderer_runtime::{
        NavigationResult, RendererMessageFailure, RendererObservation, RendererRuntimeState,
    },
    renderer_session::{
        HandlerAddFailure, HandlerKind, HandlerRegistry, HandlerToken, RendererSession,
        SessionOwnership,
    },
    resource_diagnostic::{classify_http_status, classify_mime, classify_surface_asset},
    surface_connection::{
        admitted_web_message_origin, is_admitted_surface_url, surface_entry_url,
        ConnectionResponse, MainOpener, SurfaceConnection, SURFACE_HOST,
    },
};
use bogunon_main_restore_protocol::edit_control::AdmittedEditCommand;

pub struct NativeHandlerRegistry<M: MainOpener + 'static> {
    webview: ICoreWebView2,
    webview2: ICoreWebView2_2,
    webview4: ICoreWebView2_4,
    connection: Rc<RefCell<SurfaceConnection<M>>>,
    runtime: Rc<RendererRuntimeState>,
    generation: Generation,
}

impl<M: MainOpener + 'static> NativeHandlerRegistry<M> {
    fn new(
        webview: ICoreWebView2,
        connection: SurfaceConnection<M>,
        runtime: Rc<RendererRuntimeState>,
        generation: Generation,
    ) -> Result<Self, HostError> {
        Ok(Self {
            webview2: webview.cast()?,
            webview4: webview.cast()?,
            webview,
            connection: Rc::new(RefCell::new(connection)),
            runtime,
            generation,
        })
    }
}

impl<M: MainOpener + 'static> HandlerRegistry for NativeHandlerRegistry<M> {
    type RemoveError = windows::core::Error;

    fn add(&mut self, handler: HandlerKind) -> Result<HandlerToken, HandlerAddFailure> {
        let mut token = 0_i64;
        let result = match handler {
            HandlerKind::NavigationStarting => {
                let callback = NavigationStartingEventHandler::create(Box::new(|_, args| {
                    if let Some(args) = args {
                        let mut uri = PWSTR::null();
                        // SAFETY: [Category 8 — FFI boundary] `uri` is writable pointer storage and
                        // WebView2 owns the callback arguments for the duration of this invocation.
                        unsafe { args.Uri(&mut uri) }?;
                        let uri = CoTaskMemPWSTR::from(uri).to_string();
                        let admitted = is_admitted_surface_url(&uri);
                        // SAFETY: [Category 8 — FFI boundary] the event args remain valid throughout
                        // this synchronous callback and the boolean is copied by WebView2.
                        unsafe { args.SetCancel(!admitted) }?;
                    }
                    Ok(())
                }));
                // SAFETY: [Category 8 — FFI boundary] callback is a reference-counted COM object and
                // `token` is valid writable storage. Success transfers registration ownership.
                unsafe { self.webview.add_NavigationStarting(&callback, &mut token) }
            }
            HandlerKind::NavigationCompleted => {
                let runtime = Rc::clone(&self.runtime);
                let webview = self.webview.clone();
                let callback = NavigationCompletedEventHandler::create(Box::new(move |_, args| {
                    let mut completed = false;
                    if let Some(args) = args {
                        let mut success = windows::core::BOOL(0);
                        // SAFETY: [Category 8 — FFI boundary] `success` is writable storage and args
                        // is valid for this synchronous WebView2 callback.
                        unsafe { args.IsSuccess(&mut success) }?;
                        if success.as_bool() {
                            let mut source = PWSTR::null();
                            // SAFETY: [Category 8 — FFI boundary] `source` is writable pointer
                            // storage and the captured WebView remains registered for this callback.
                            unsafe { webview.Source(&mut source) }?;
                            completed =
                                is_admitted_surface_url(&CoTaskMemPWSTR::from(source).to_string());
                            if completed {
                                runtime.observe(RendererObservation::HtmlDocumentLoaded);
                            }
                        }
                    }
                    runtime.finish_navigation(if completed {
                        NavigationResult::Succeeded
                    } else {
                        NavigationResult::Failed
                    });
                    Ok(())
                }));
                // SAFETY: [Category 8 — FFI boundary] same registration ownership contract as above.
                unsafe { self.webview.add_NavigationCompleted(&callback, &mut token) }
            }
            HandlerKind::NewWindowRequested => {
                let callback = NewWindowRequestedEventHandler::create(Box::new(|_, args| {
                    if let Some(args) = args {
                        // SAFETY: [Category 8 — FFI boundary] event args are live for the callback;
                        // setting handled blocks creation of an untrusted secondary window.
                        unsafe { args.SetHandled(true) }?;
                    }
                    Ok(())
                }));
                // SAFETY: [Category 8 — FFI boundary] same registration ownership contract as above.
                unsafe { self.webview.add_NewWindowRequested(&callback, &mut token) }
            }
            HandlerKind::FrameCreated => {
                let callback = FrameCreatedEventHandler::create(Box::new(|_, _| Ok(())));
                // SAFETY: [Category 8 — FFI boundary] same registration ownership contract as above.
                unsafe { self.webview4.add_FrameCreated(&callback, &mut token) }
            }
            HandlerKind::WebMessageReceived => {
                let connection = Rc::clone(&self.connection);
                let runtime = Rc::clone(&self.runtime);
                let webview = self.webview.clone();
                let generation = self.generation;
                let callback = WebMessageReceivedEventHandler::create(Box::new(move |_, args| {
                    runtime.observe(RendererObservation::WebMessageReceived);
                    let Some(args) = args else {
                        return Ok(());
                    };
                    let mut source = PWSTR::null();
                    let mut payload = PWSTR::null();
                    // SAFETY: [Category 8 — FFI boundary] both values are writable pointer storage;
                    // WebView2 returns CoTaskMem-owned strings consumed immediately below.
                    unsafe {
                        args.Source(&mut source)?;
                    }
                    let source = CoTaskMemPWSTR::from(source).to_string();
                    let Some(origin) = admitted_web_message_origin(&source, generation) else {
                        runtime.reject_message(RendererMessageFailure::Source);
                        return Ok(());
                    };
                    // SAFETY: [Category 8 — FFI boundary] `payload` is writable pointer storage;
                    // WebView2 returns CoTaskMem text only for a JavaScript string message.
                    if unsafe { args.TryGetWebMessageAsString(&mut payload) }.is_err() {
                        runtime.reject_message(RendererMessageFailure::Payload);
                        return Ok(());
                    }
                    let payload = CoTaskMemPWSTR::from(payload).to_string();
                    let response = match connection.try_borrow_mut() {
                        Ok(mut connection) => {
                            match connection.handle(payload.as_bytes(), origin, true) {
                                Ok(response) => Some(response),
                                Err(_) => {
                                    runtime.reject_message(RendererMessageFailure::Contract);
                                    None
                                }
                            }
                        }
                        Err(_) => {
                            runtime.reject_message(RendererMessageFailure::Contract);
                            None
                        }
                    };
                    if response.is_some() {
                        runtime.observe(RendererObservation::MessageContractAccepted);
                    }
                    match response {
                        Some(ConnectionResponse::Projection(response)) => {
                            let response = wide(OsStr::new(&response));
                            // SAFETY: [Category 8 — FFI boundary] response is NUL-terminated UTF-16
                            // and remains alive for this synchronous post operation.
                            unsafe { webview.PostWebMessageAsJson(PCWSTR(response.as_ptr())) }?;
                            runtime.observe(RendererObservation::ProjectionResponseSent);
                        }
                        Some(ConnectionResponse::RendererReady) => {
                            let _ = runtime.mark_ready();
                            runtime.observe(RendererObservation::RendererReadyAccepted);
                        }
                        _ => {}
                    }
                    Ok(())
                }));
                // SAFETY: [Category 8 — FFI boundary] same registration ownership contract as above.
                unsafe { self.webview.add_WebMessageReceived(&callback, &mut token) }
            }
            HandlerKind::WebResourceResponseReceived => {
                let runtime = Rc::clone(&self.runtime);
                let callback =
                    WebResourceResponseReceivedEventHandler::create(Box::new(move |_, args| {
                        let Some(args) = args else {
                            runtime.observe(RendererObservation::AssetResponseInspectionFailed);
                            return Ok(());
                        };
                        let inspected = (|| -> windows::core::Result<()> {
                            // SAFETY: [Category 8 — FFI boundary] callback arguments remain valid
                            // for this invocation and return reference-counted COM interfaces.
                            let request = unsafe { args.Request()? };
                            let mut uri = PWSTR::null();
                            // SAFETY: [Category 8 — FFI boundary] `uri` is writable pointer storage;
                            // the returned string is classified immediately and never persisted.
                            unsafe { request.Uri(&mut uri)? };
                            let uri = CoTaskMemPWSTR::from(uri).to_string();
                            let Some(asset) = classify_surface_asset(&uri) else {
                                return Ok(());
                            };
                            // SAFETY: [Category 8 — FFI boundary] response and headers are owned COM
                            // views valid for this callback; only status and Content-Type are read.
                            let response = unsafe { args.Response()? };
                            let mut status = 0_i32;
                            // SAFETY: [Category 8 — FFI boundary] `status` is writable storage and
                            // the response view remains live for this synchronous callback.
                            unsafe { response.StatusCode(&mut status)? };
                            // SAFETY: [Category 8 — FFI boundary] the response view is live and
                            // returns a reference-counted headers interface.
                            let headers = unsafe { response.Headers()? };
                            let header_name = wide(OsStr::new("Content-Type"));
                            let mut header_value = PWSTR::null();
                            // SAFETY: [Category 8 — FFI boundary] the fixed header name is
                            // NUL-terminated and `header_value` is writable pointer storage.
                            let content_type = if unsafe {
                                headers.GetHeader(PCWSTR(header_name.as_ptr()), &mut header_value)
                            }
                            .is_ok()
                            {
                                Some(CoTaskMemPWSTR::from(header_value).to_string())
                            } else {
                                None
                            };
                            runtime.observe_asset_response(
                                asset,
                                classify_http_status(status),
                                classify_mime(asset, content_type.as_deref()),
                            );
                            Ok(())
                        })();
                        if inspected.is_err() {
                            runtime.observe(RendererObservation::AssetResponseInspectionFailed);
                        }
                        Ok(())
                    }));
                // SAFETY: [Category 8 — FFI boundary] callback is reference-counted and token is
                // writable storage. RendererSession owns the token until verified removal.
                unsafe {
                    self.webview2
                        .add_WebResourceResponseReceived(&callback, &mut token)
                }
            }
        };
        result
            .map(|()| HandlerToken(u64::from_ne_bytes(token.to_ne_bytes())))
            // WebView2 did not return a successful registration result, but an FFI failure does
            // not prove that no native callback reference survived. Preserve fail-closed cleanup.
            .map_err(|_| HandlerAddFailure::Unresolved)
    }

    fn remove(
        &mut self,
        handler: HandlerKind,
        token: HandlerToken,
    ) -> Result<(), Self::RemoveError> {
        let token = i64::from_ne_bytes(token.0.to_ne_bytes());
        // SAFETY: [Category 8 — FFI boundary] the token was returned by the matching add method on
        // this exact WebView, and RendererSession guarantees one removal attempt per owned token.
        unsafe {
            match handler {
                HandlerKind::NavigationStarting => self.webview.remove_NavigationStarting(token),
                HandlerKind::NavigationCompleted => self.webview.remove_NavigationCompleted(token),
                HandlerKind::NewWindowRequested => self.webview.remove_NewWindowRequested(token),
                HandlerKind::FrameCreated => self.webview4.remove_FrameCreated(token),
                HandlerKind::WebMessageReceived => self.webview.remove_WebMessageReceived(token),
                HandlerKind::WebResourceResponseReceived => {
                    self.webview2.remove_WebResourceResponseReceived(token)
                }
            }
        }
    }
}

pub struct AttachedRenderer<M: MainOpener + 'static> {
    pub session: RendererSession<NativeHandlerRegistry<M>>,
    pub runtime: Rc<RendererRuntimeState>,
    webview: ICoreWebView2,
    generation: Generation,
}

impl<M: MainOpener + 'static> AttachedRenderer<M> {
    pub fn send_edit_control(&self, control: AdmittedEditCommand) -> Result<(), HostError> {
        let payload = serde_json::json!({
            "kind": "SurfaceEditControl",
            "generation": self.generation.get(),
            "sequence": control.sequence,
            "command": control.command.wire_name(),
        })
        .to_string();
        let payload = wide(OsStr::new(&payload));
        // SAFETY: [Category 8 — FFI boundary] payload is a NUL-terminated UTF-16 JSON value
        // containing only fixed edit-control fields and remains alive for the synchronous call.
        unsafe { self.webview.PostWebMessageAsJson(PCWSTR(payload.as_ptr())) }?;
        Ok(())
    }

    pub fn probe_script_stage(&self) -> Result<(), HostError> {
        if !self.runtime.begin_script_probe() {
            return Ok(());
        }
        let runtime = Rc::clone(&self.runtime);
        let callback =
            ExecuteScriptCompletedHandler::create(Box::new(move |error_code, result| {
                if error_code.is_ok() {
                    runtime.finish_script_probe(Some(&result));
                } else {
                    runtime.finish_script_probe(None);
                }
                error_code
            }));
        let script = wide(OsStr::new(
            "(() => { const root = document.getElementById('surface-root'); return root === null ? 'root_missing' : (root.dataset.runtimeStage || 'html_document_loaded'); })()",
        ));
        // SAFETY: [Category 8 — FFI boundary] the fixed read-only script and callback remain valid
        // for this asynchronous WebView2 request; the callback records only allowlisted stage codes.
        if let Err(error) = unsafe {
            self.webview
                .ExecuteScript(PCWSTR(script.as_ptr()), &callback)
        } {
            self.runtime.cancel_script_probe();
            self.runtime.observe(RendererObservation::ScriptProbeFailed);
            return Err(HostError::Com(error));
        }
        Ok(())
    }
}

pub fn attach_surface_renderer<M: MainOpener + 'static>(
    controller: &ICoreWebView2Controller,
    bundle_dir: &Path,
    generation: Generation,
    main: M,
    ledger: &mut Ledger,
    attempt: Attempt,
    diagnostic: &mut crate::diagnostic::QaRuntimeDiagnostic,
) -> Result<AttachedRenderer<M>, HostError> {
    let mapping_dir = resolve_surface_bundle_mapping(bundle_dir)?;
    // SAFETY: [Category 8 — FFI boundary] the controller completed successfully and owns a live
    // CoreWebView2 on the current STA thread.
    let webview = unsafe { controller.CoreWebView2() }?;
    let webview3: ICoreWebView2_3 = webview.cast()?;
    let host = wide(OsStr::new(SURFACE_HOST));
    let folder = wide(mapping_dir.as_os_str());
    diagnostic.begin(crate::diagnostic::RuntimeStage::VirtualHostMapping)?;
    // SAFETY: [Category 8 — FFI boundary] both paths are NUL-terminated UTF-16 and remain alive for
    // this call. DENY_CORS prevents mapped content from becoming a cross-origin data surface.
    unsafe {
        webview3.SetVirtualHostNameToFolderMapping(
            PCWSTR(host.as_ptr()),
            PCWSTR(folder.as_ptr()),
            COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY_CORS,
        )
    }?;
    diagnostic.complete(crate::diagnostic::RuntimeStage::VirtualHostMapping)?;
    diagnostic.begin(crate::diagnostic::RuntimeStage::RendererSessionRegistration)?;
    let runtime = Rc::new(RendererRuntimeState::new());
    let registry = NativeHandlerRegistry::new(
        webview.clone(),
        SurfaceConnection::new(generation, main),
        Rc::clone(&runtime),
        generation,
    )?;
    let mut session = RendererSession::begin(registry, ledger, SessionOwnership::new(attempt, 7))?;
    for handler in [
        HandlerKind::NavigationStarting,
        HandlerKind::NavigationCompleted,
        HandlerKind::NewWindowRequested,
        HandlerKind::FrameCreated,
        HandlerKind::WebResourceResponseReceived,
        HandlerKind::WebMessageReceived,
    ] {
        session.register(handler)?;
    }
    diagnostic.complete(crate::diagnostic::RuntimeStage::RendererSessionRegistration)?;
    diagnostic.begin(crate::diagnostic::RuntimeStage::HtmlNavigation)?;
    let entry_url = surface_entry_url(generation);
    let entry = wide(OsStr::new(&entry_url));
    // SAFETY: [Category 8 — FFI boundary] entry is an admitted, NUL-terminated fixed origin URL and
    // remains alive for the synchronous Navigate call.
    unsafe { webview.Navigate(PCWSTR(entry.as_ptr())) }?;
    Ok(AttachedRenderer {
        session,
        runtime,
        webview,
        generation,
    })
}
