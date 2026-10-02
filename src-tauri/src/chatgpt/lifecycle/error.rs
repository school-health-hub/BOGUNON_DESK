use std::{error::Error, fmt};

use crate::chatgpt::{
    http::{HttpError, TransportError},
    oauth::OAuthError,
    oidc::OidcError,
    storage::StorageError,
};

#[derive(Debug)]
pub(crate) enum ChatGptLifecycleError {
    BrowserOpen,
    Busy,
    CallbackWorker,
    Clock,
    StoragePath,
    SubjectMismatch,
    Http(HttpError),
    OAuth(OAuthError),
    Oidc(OidcError),
    Storage(StorageError),
    Transport(TransportError),
}

impl From<HttpError> for ChatGptLifecycleError {
    fn from(value: HttpError) -> Self {
        Self::Http(value)
    }
}

impl From<OAuthError> for ChatGptLifecycleError {
    fn from(value: OAuthError) -> Self {
        Self::OAuth(value)
    }
}

impl From<OidcError> for ChatGptLifecycleError {
    fn from(value: OidcError) -> Self {
        Self::Oidc(value)
    }
}

impl From<StorageError> for ChatGptLifecycleError {
    fn from(value: StorageError) -> Self {
        Self::Storage(value)
    }
}

impl From<TransportError> for ChatGptLifecycleError {
    fn from(value: TransportError) -> Self {
        Self::Transport(value)
    }
}

impl fmt::Display for ChatGptLifecycleError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::BrowserOpen => formatter.write_str("Windows 기본 브라우저를 열지 못했습니다."),
            Self::Busy => formatter.write_str("ChatGPT 로그인이 이미 진행 중입니다."),
            Self::CallbackWorker => {
                formatter.write_str("ChatGPT 로그인 응답을 처리할 수 없습니다.")
            }
            Self::Clock => formatter.write_str("ChatGPT 연결 시간을 기록할 수 없습니다."),
            Self::StoragePath => formatter.write_str("ChatGPT 연결 저장소에 접근할 수 없습니다."),
            Self::SubjectMismatch => {
                formatter.write_str("이 PC에 등록된 ChatGPT 계정과 다른 계정입니다.")
            }
            Self::Http(error) => error.fmt(formatter),
            Self::OAuth(error) => error.fmt(formatter),
            Self::Oidc(error) => error.fmt(formatter),
            Self::Storage(error) => error.fmt(formatter),
            Self::Transport(error) => error.fmt(formatter),
        }
    }
}

impl Error for ChatGptLifecycleError {}
