use tokio::sync::{Mutex, MutexGuard};

#[derive(Default)]
pub(crate) struct ChatGptCredentialMutationState {
    mutation: Mutex<()>,
}

impl ChatGptCredentialMutationState {
    pub(crate) async fn lock(&self) -> MutexGuard<'_, ()> {
        self.mutation.lock().await
    }
}
