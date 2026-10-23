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
    release: SubscriptionReleaseState,
    receiver: mpsc::Receiver<BrowserExitObservation>,
    _creator_thread: std::marker::PhantomData<std::rc::Rc<()>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct SubscriptionReleaseState {
    owned: bool,
}

impl SubscriptionReleaseState {
    const fn owned() -> Self {
        Self { owned: true }
    }

    #[cfg(test)]
    const fn is_owned(self) -> bool {
        self.owned
    }
}

fn confirm_subscription_release<E>(
    state: &mut SubscriptionReleaseState,
    unsubscribe: impl FnOnce() -> Result<(), E>,
) -> Result<(), E> {
    if state.owned {
        unsubscribe()?;
        state.owned = false;
    }
    Ok(())
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
            release: SubscriptionReleaseState::owned(),
            receiver,
            _creator_thread: std::marker::PhantomData,
        })
    }

    /// Explicit result-bearing removal for QA; Drop remains the fallback on errors.
    pub fn unsubscribe(mut self) -> Result<(), HostError> {
        let environment = self.environment.clone();
        let token = self.token;
        confirm_subscription_release(&mut self.release, || {
            // SAFETY: the token belongs to this exact live environment on its owning STA.
            unsafe { environment.remove_BrowserProcessExited(token) }.map_err(HostError::Com)
        })
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
        let environment = self.environment.clone();
        let token = self.token;
        let _ = confirm_subscription_release(&mut self.release, || {
            // SAFETY: the live token belongs to this exact environment on this STA.
            unsafe { environment.remove_BrowserProcessExited(token) }.map_err(HostError::Com)
        });
    }
}

#[cfg(test)]
mod tests {
    use super::{confirm_subscription_release, SubscriptionReleaseState};
    use std::cell::Cell;

    #[test]
    fn subscription_remains_owned_when_native_unsubscribe_fails() {
        let mut state = SubscriptionReleaseState::owned();

        let result =
            confirm_subscription_release(&mut state, || Err::<(), _>("unsubscribe failed"));

        assert_eq!(result, Err("unsubscribe failed"));
        assert!(state.is_owned());
    }

    #[test]
    fn confirmed_subscription_release_is_idempotent_at_the_internal_state_seam() {
        let mut state = SubscriptionReleaseState::owned();
        let calls = Cell::new(0);
        let release = || {
            calls.set(calls.get() + 1);
            Ok::<(), &str>(())
        };

        assert_eq!(confirm_subscription_release(&mut state, release), Ok(()));
        assert_eq!(confirm_subscription_release(&mut state, release), Ok(()));
        assert_eq!(calls.get(), 1);
        assert!(!state.is_owned());
    }
}
