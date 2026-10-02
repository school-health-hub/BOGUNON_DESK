use std::io::Read as _;

use super::{CallbackResult, LoopbackError};
use crate::chatgpt::model::{AuthorizationClient, AuthorizationCode, IssuedClientId, OAuthAttempt};

const REQUEST_LINE_LIMIT: usize = 8 * 1024;
const HEADER_LIMIT: usize = 16 * 1024;

pub(super) struct CallbackRequest {
    target: String,
}

pub(super) fn read_request(
    stream: &mut std::net::TcpStream,
    expected_port: u16,
) -> Result<CallbackRequest, RequestError> {
    let mut bytes = Vec::with_capacity(1024);
    let mut byte = [0_u8; 1];
    loop {
        let count = stream.read(&mut byte).map_err(map_io_error)?;
        if count == 0 {
            return Err(RequestError::Malformed);
        }
        bytes.push(byte[0]);
        if first_line_length(&bytes) > REQUEST_LINE_LIMIT {
            return Err(RequestError::RequestLineTooLarge);
        }
        if bytes.len() > HEADER_LIMIT {
            return Err(RequestError::HeadersTooLarge);
        }
        if bytes.ends_with(b"\r\n\r\n") {
            break;
        }
    }
    let headers = std::str::from_utf8(&bytes).map_err(|_| RequestError::Malformed)?;
    let request_line = headers
        .split_once("\r\n")
        .map(|(line, _)| line)
        .ok_or(RequestError::Malformed)?;
    let mut parts = request_line.split(' ');
    let method = parts.next().ok_or(RequestError::Malformed)?;
    let target = parts.next().ok_or(RequestError::Malformed)?;
    let version = parts.next().ok_or(RequestError::Malformed)?;
    if parts.next().is_some() || !matches!(version, "HTTP/1.0" | "HTTP/1.1") {
        return Err(RequestError::Malformed);
    }
    if method != "GET" {
        return Err(RequestError::MethodNotAllowed);
    }
    let path = target.split('?').next().ok_or(RequestError::Malformed)?;
    if path != "/auth/callback" {
        return Err(RequestError::InvalidPath);
    }
    validate_host(headers, expected_port)?;
    Ok(CallbackRequest {
        target: target.to_owned(),
    })
}

fn validate_host(headers: &str, expected_port: u16) -> Result<(), RequestError> {
    let expected = format!("127.0.0.1:{expected_port}");
    let mut host = None;
    for line in headers
        .split("\r\n")
        .skip(1)
        .take_while(|line| !line.is_empty())
    {
        let (name, value) = line.split_once(':').ok_or(RequestError::InvalidHost)?;
        if name.eq_ignore_ascii_case("host") {
            if host.replace(value.trim()).is_some() {
                return Err(RequestError::InvalidHost);
            }
        }
    }
    (host == Some(expected.as_str()))
        .then_some(())
        .ok_or(RequestError::InvalidHost)
}

fn map_io_error(error: std::io::Error) -> RequestError {
    match error.kind() {
        std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock => RequestError::Timeout,
        _ => RequestError::Network,
    }
}

pub(super) fn parse_callback(
    request: &CallbackRequest,
    attempt: &OAuthAttempt,
) -> Result<CallbackResult, LoopbackError> {
    let url = reqwest::Url::parse(&format!("http://127.0.0.1{}", request.target))
        .map_err(|_| LoopbackError::MalformedRequest)?;
    let state = unique_query_value(&url, "state")?.ok_or(LoopbackError::MissingState)?;
    if state != attempt.state.expose() {
        return Err(LoopbackError::StateMismatch);
    }
    if let Some(provider_error) = unique_query_value(&url, "error")? {
        return if provider_error == "access_denied" {
            Err(LoopbackError::Cancelled)
        } else {
            Err(LoopbackError::ProviderFailure)
        };
    }
    let code = unique_query_value(&url, "code")?
        .filter(|value| !value.is_empty())
        .ok_or(LoopbackError::MissingAuthorizationCode)?;
    let callback_client = unique_query_value(&url, "client_id")?;
    let issued_client_id = resolve_client_id(&attempt.client, callback_client.as_deref())?;
    Ok(CallbackResult {
        authorization_code: AuthorizationCode::new(code),
        issued_client_id,
    })
}

fn unique_query_value(url: &reqwest::Url, key: &str) -> Result<Option<String>, LoopbackError> {
    let mut values = url.query_pairs().filter(|(name, _)| name == key);
    let first = values.next().map(|(_, value)| value.into_owned());
    if values.next().is_some() {
        return Err(LoopbackError::MalformedRequest);
    }
    Ok(first)
}

fn resolve_client_id(
    pending: &AuthorizationClient,
    callback: Option<&str>,
) -> Result<IssuedClientId, LoopbackError> {
    match pending {
        AuthorizationClient::Dynamic => callback
            .and_then(|value| IssuedClientId::parse(value).ok())
            .ok_or(LoopbackError::InvalidClientRegistration),
        AuthorizationClient::Issued(expected) => match callback {
            None => Ok(expected.clone()),
            Some(value) => {
                let received =
                    IssuedClientId::parse(value).map_err(|_| LoopbackError::ClientMismatch)?;
                (received == *expected)
                    .then_some(received)
                    .ok_or(LoopbackError::ClientMismatch)
            }
        },
    }
}

fn first_line_length(bytes: &[u8]) -> usize {
    bytes
        .windows(2)
        .position(|window| window == b"\r\n")
        .unwrap_or(bytes.len())
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum RequestError {
    Network,
    Timeout,
    Malformed,
    MethodNotAllowed,
    InvalidPath,
    InvalidHost,
    RequestLineTooLarge,
    HeadersTooLarge,
}
