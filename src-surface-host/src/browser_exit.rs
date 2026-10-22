use std::sync::mpsc;

use webview2_com::{
    BrowserProcessExitedEventHandler,
    Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Environment, ICoreWebView2Environment5,
        COREWEBVIEW2_BROWSER_PROCESS_EXIT_KIND_NORMAL,
    },
};
use windows::core::Interface;

use crate::windows_host::{HostError, RuntimeBinding};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BrowserExitObservation {
    pub binding: RuntimeBinding,
    pub browser_process_id: u32,
    pub normal: bool,
}

pub struct BrowserExitSubscription {
    environment: ICoreWebView2Environment5,
    token: i64,
    subscribed: bool,
    receiver: mpsc::Receiver<BrowserExitObservation>,
    _creator_thread: std::marker::PhantomData<std::rc::Rc<()>>,
}

impl BrowserExitSubscription {
    pub fn subscribe(
        environment: &ICoreWebView2Environment,
        binding: RuntimeBinding,
    ) -> Result<Self, HostError> {
        let environment: ICoreWebView2Environment5 = environment.cast()?;
        let (sender, receiver) = mpsc::channel();
        let handler = BrowserProcessExitedEventHandler::create(Box::new(move |_sender, args| {
            let args = args.ok_or_else(windows::core::Error::from_win32)?;
            let mut browser_process_id = 0;
            let mut kind = Default::default();
            // SAFETY: both output pointers refer to initialized writable stack storage.
            unsafe {
                args.BrowserProcessId(&mut browser_process_id)?;
                args.BrowserProcessExitKind(&mut kind)?;
            }
            sender
                .send(BrowserExitObservation {
                    binding,
                    browser_process_id,
                    normal: kind == COREWEBVIEW2_BROWSER_PROCESS_EXIT_KIND_NORMAL,
                })
                .map_err(|_| windows::core::Error::from_win32())?;
            Ok(())
        }));
        let mut token = 0;
        // SAFETY: token points to writable storage and handler is retained by the environment.
        unsafe { environment.add_BrowserProcessExited(&handler, &mut token) }?;
        Ok(Self {
            environment,
            token,
            subscribed: true,
            receiver,
            _creator_thread: std::marker::PhantomData,
        })
    }

    /// Explicit result-bearing removal for QA; Drop remains the fallback on errors.
    pub fn unsubscribe(mut self) -> Result<(), HostError> {
        // SAFETY: the token belongs to this exact live environment on its owning STA.
        unsafe { self.environment.remove_BrowserProcessExited(self.token) }?;
        self.subscribed = false;
        Ok(())
    }

    pub fn try_observe(&self) -> Result<Option<BrowserExitObservation>, HostError> {
        match self.receiver.try_recv() {
            Ok(observation) => Ok(Some(observation)),
            Err(mpsc::TryRecvError::Empty) => Ok(None),
            Err(mpsc::TryRecvError::Disconnected) => Err(HostError::CallbackLost),
        }
    }
}

impl Drop for BrowserExitSubscription {
    fn drop(&mut self) {
        // SAFETY: this token was returned by this exact environment and is removed once.
        if self.subscribed {
            // SAFETY: the live token belongs to this exact environment on this STA.
            let _ = unsafe { self.environment.remove_BrowserProcessExited(self.token) };
        }
    }
}
