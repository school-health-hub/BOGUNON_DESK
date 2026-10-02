mod request;

use std::{
    error::Error,
    fmt,
    io::Write as _,
    net::{SocketAddr, TcpListener, TcpStream},
    thread,
    time::{Duration, Instant},
};

use self::request::{parse_callback, read_request, RequestError};
use super::model::{AuthorizationCode, IssuedClientId, OAuthAttempt};

pub(crate) const DEFAULT_CALLBACK_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const ACCEPT_POLL_INTERVAL: Duration = Duration::from_millis(5);
const SUCCESS_HTML: &str =
    "<!doctype html><meta charset=utf-8><title>Connected</title><p>ChatGPT connection complete. You can close this window.</p>";
const CANCEL_HTML: &str =
    "<!doctype html><meta charset=utf-8><title>Cancelled</title><p>ChatGPT connection cancelled. You can close this window.</p>";
const FAILURE_HTML: &str =
    "<!doctype html><meta charset=utf-8><title>Failed</title><p>ChatGPT connection failed. You can close this window.</p>";

pub(crate) struct CallbackResult {
    pub(crate) authorization_code: AuthorizationCode,
    pub(crate) issued_client_id: IssuedClientId,
}

pub(crate) struct LoopbackListener {
    listener: TcpListener,
    address: SocketAddr,
    redirect_uri: String,
}

impl LoopbackListener {
    pub(crate) fn bind() -> Result<Self, LoopbackError> {
        let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
            .map_err(|_| LoopbackError::Network)?;
        listener
            .set_nonblocking(true)
            .map_err(|_| LoopbackError::Network)?;
        let address = listener.local_addr().map_err(|_| LoopbackError::Network)?;
        let redirect_uri = format!("http://127.0.0.1:{}/auth/callback", address.port());
        Ok(Self {
            listener,
            address,
            redirect_uri,
        })
    }

    #[cfg(test)]
    pub(crate) const fn local_addr(&self) -> SocketAddr {
        self.address
    }

    pub(crate) fn redirect_uri(&self) -> &str {
        &self.redirect_uri
    }

    pub(crate) fn wait_for_callback(
        self,
        attempt: &OAuthAttempt,
        timeout: Duration,
    ) -> Result<CallbackResult, LoopbackError> {
        let deadline = Instant::now()
            .checked_add(timeout)
            .ok_or(LoopbackError::Timeout)?;
        let (mut stream, _) = self.accept_until(deadline)?;
        stream
            .set_nonblocking(false)
            .map_err(|_| LoopbackError::Network)?;
        let remaining = deadline
            .checked_duration_since(Instant::now())
            .ok_or(LoopbackError::Timeout)?;
        stream
            .set_read_timeout(Some(remaining))
            .map_err(|_| LoopbackError::Network)?;
        stream
            .set_write_timeout(Some(remaining))
            .map_err(|_| LoopbackError::Network)?;
        let result = read_request(&mut stream, self.address.port())
            .map_err(LoopbackError::from)
            .and_then(|request| parse_callback(&request, attempt));
        write_browser_response(&mut stream, &result);
        result
    }

    fn accept_until(&self, deadline: Instant) -> Result<(TcpStream, SocketAddr), LoopbackError> {
        loop {
            match self.listener.accept() {
                Ok(connection) => return Ok(connection),
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    let remaining = deadline
                        .checked_duration_since(Instant::now())
                        .ok_or(LoopbackError::Timeout)?;
                    thread::sleep(remaining.min(ACCEPT_POLL_INTERVAL));
                }
                Err(_) => return Err(LoopbackError::Network),
            }
        }
    }
}

fn write_browser_response(stream: &mut TcpStream, result: &Result<CallbackResult, LoopbackError>) {
    let (status, body) = match result {
        Ok(_) => ("200 OK", SUCCESS_HTML),
        Err(LoopbackError::Cancelled) => ("200 OK", CANCEL_HTML),
        Err(_) => ("400 Bad Request", FAILURE_HTML),
    };
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n{body}",
        body.len()
    );
    let _result = stream.write_all(response.as_bytes());
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum LoopbackError {
    Network,
    Timeout,
    MalformedRequest,
    MethodNotAllowed,
    InvalidCallbackPath,
    InvalidCallbackHost,
    RequestLineTooLarge,
    HeadersTooLarge,
    MissingState,
    StateMismatch,
    Cancelled,
    ProviderFailure,
    MissingAuthorizationCode,
    InvalidClientRegistration,
    ClientMismatch,
}

impl From<RequestError> for LoopbackError {
    fn from(value: RequestError) -> Self {
        match value {
            RequestError::Network => Self::Network,
            RequestError::Timeout => Self::Timeout,
            RequestError::Malformed => Self::MalformedRequest,
            RequestError::MethodNotAllowed => Self::MethodNotAllowed,
            RequestError::InvalidPath => Self::InvalidCallbackPath,
            RequestError::InvalidHost => Self::InvalidCallbackHost,
            RequestError::RequestLineTooLarge => Self::RequestLineTooLarge,
            RequestError::HeadersTooLarge => Self::HeadersTooLarge,
        }
    }
}

impl fmt::Display for LoopbackError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::Network => "ChatGPT 로그인 응답을 받을 수 없습니다.",
            Self::Timeout => "ChatGPT 로그인 시간이 초과되었습니다.",
            Self::Cancelled => "ChatGPT 로그인이 취소되었습니다.",
            Self::MalformedRequest
            | Self::MethodNotAllowed
            | Self::InvalidCallbackPath
            | Self::InvalidCallbackHost
            | Self::RequestLineTooLarge
            | Self::HeadersTooLarge
            | Self::MissingState
            | Self::StateMismatch
            | Self::ProviderFailure
            | Self::MissingAuthorizationCode
            | Self::InvalidClientRegistration
            | Self::ClientMismatch => "ChatGPT 로그인 응답을 확인할 수 없습니다.",
        };
        formatter.write_str(message)
    }
}

impl Error for LoopbackError {}

#[cfg(test)]
#[path = "loopback/tests.rs"]
mod tests;
