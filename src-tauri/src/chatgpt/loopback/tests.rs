use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    thread,
    time::Duration,
};

use super::{CallbackResult, LoopbackError, LoopbackListener};
use crate::chatgpt::{
    model::{AuthorizationClient, IssuedClientId},
    oauth::create_attempt,
};

const HOST_ID: &str = "urn:uuid:6b30c832-a704-47cb-8bca-1f820f164f5d";

fn send(address: SocketAddr, request: String) -> thread::JoinHandle<String> {
    thread::spawn(move || {
        let mut stream = TcpStream::connect(address).expect("callback client must connect");
        stream
            .write_all(request.as_bytes())
            .expect("callback request must write");
        stream
            .shutdown(std::net::Shutdown::Write)
            .expect("callback request must finish");
        let mut response = String::new();
        stream
            .read_to_string(&mut response)
            .expect("callback response must read");
        response
    })
}

fn request(address: SocketAddr, method: &str, target: &str) -> String {
    format!("{method} {target} HTTP/1.1\r\nHost: {address}\r\n\r\n")
}

fn dynamic_attempt(listener: &LoopbackListener) -> crate::chatgpt::model::OAuthAttempt {
    create_attempt(
        AuthorizationClient::Dynamic,
        HOST_ID,
        listener.redirect_uri(),
    )
    .expect("OAuth attempt")
}

fn callback_error(result: Result<CallbackResult, LoopbackError>) -> LoopbackError {
    match result {
        Ok(_) => panic!("callback must fail"),
        Err(error) => error,
    }
}

fn assert_listener_closed(address: SocketAddr) {
    assert!(TcpStream::connect_timeout(&address, Duration::from_millis(100)).is_err());
}

#[test]
fn accepts_one_valid_get_and_returns_success_html() {
    // Given a bound listener and matching first-registration callback
    let listener = LoopbackListener::bind().expect("listener");
    let address = listener.local_addr();
    let attempt = dynamic_attempt(&listener);
    let target = format!(
        "/auth/callback?code=code-sentinel&state={}&client_id=oaiapp_new-client",
        attempt.state.expose()
    );
    let request = request(address, "GET", &target);
    let client = send(address, request);

    // When the one-shot callback is handled
    let callback = listener
        .wait_for_callback(&attempt, Duration::from_secs(1))
        .expect("valid callback");

    // Then the typed result is returned and the listener closes
    assert_eq!(callback.authorization_code.expose(), "code-sentinel");
    assert_eq!(callback.issued_client_id.as_str(), "oaiapp_new-client");
    let response = client.join().expect("callback client");
    assert!(response.starts_with("HTTP/1.1 200"));
    assert!(response.contains("ChatGPT connection complete"));
    assert_listener_closed(address);
}

#[test]
fn returning_callback_uses_pending_client_when_callback_omits_it() {
    // Given a returning attempt and a callback without client_id
    let listener = LoopbackListener::bind().expect("listener");
    let address = listener.local_addr();
    let client_id = IssuedClientId::parse("oaiapp_existing").expect("issued client");
    let attempt = create_attempt(
        AuthorizationClient::Issued(client_id),
        HOST_ID,
        listener.redirect_uri(),
    )
    .expect("OAuth attempt");
    let target = format!(
        "/auth/callback?code=code-sentinel&state={}",
        attempt.state.expose()
    );
    let client = send(address, request(address, "GET", &target));

    // When the callback is handled
    let callback = listener
        .wait_for_callback(&attempt, Duration::from_secs(1))
        .expect("valid returning callback");

    // Then the pending issued client is retained
    assert_eq!(callback.issued_client_id.as_str(), "oaiapp_existing");
    client.join().expect("callback client");
}

#[test]
fn rejects_missing_or_wrong_client_id_for_registration_mode() {
    for suffix in ["", "&client_id=dynamic_agent_client", "&client_id=other"] {
        // Given a first-registration callback with no valid issued client ID
        let listener = LoopbackListener::bind().expect("listener");
        let address = listener.local_addr();
        let attempt = dynamic_attempt(&listener);
        let target = format!(
            "/auth/callback?code=code-sentinel&state={}{}",
            attempt.state.expose(),
            suffix
        );
        let client = send(address, request(address, "GET", &target));

        // When the callback is handled, then it is rejected without sensitive output
        let error = callback_error(listener.wait_for_callback(&attempt, Duration::from_secs(1)));
        assert_eq!(error, LoopbackError::InvalidClientRegistration);
        assert!(!format!("{error:?}").contains("code-sentinel"));
        client.join().expect("callback client");
    }
}

#[test]
fn rejects_different_client_id_for_returning_attempt() {
    // Given a returning attempt whose callback names another issued client
    let listener = LoopbackListener::bind().expect("listener");
    let address = listener.local_addr();
    let attempt = create_attempt(
        AuthorizationClient::Issued(
            IssuedClientId::parse("oaiapp_expected").expect("issued client"),
        ),
        HOST_ID,
        listener.redirect_uri(),
    )
    .expect("OAuth attempt");
    let target = format!(
        "/auth/callback?code=code-sentinel&state={}&client_id=oaiapp_different",
        attempt.state.expose()
    );
    let client = send(address, request(address, "GET", &target));

    // When handled, then replacement is rejected
    let error = callback_error(listener.wait_for_callback(&attempt, Duration::from_secs(1)));
    assert_eq!(error, LoopbackError::ClientMismatch);
    client.join().expect("callback client");
}

#[test]
fn accepts_same_client_id_for_returning_attempt() {
    // Given a returning attempt whose callback repeats the pending issued client
    let listener = LoopbackListener::bind().expect("listener");
    let address = listener.local_addr();
    let attempt = create_attempt(
        AuthorizationClient::Issued(
            IssuedClientId::parse("oaiapp_expected").expect("issued client"),
        ),
        HOST_ID,
        listener.redirect_uri(),
    )
    .expect("OAuth attempt");
    let target = format!(
        "/auth/callback?code=code-sentinel&state={}&client_id=oaiapp_expected",
        attempt.state.expose()
    );
    let client = send(address, request(address, "GET", &target));

    // When handled, then the matching client is accepted
    let callback = listener
        .wait_for_callback(&attempt, Duration::from_secs(1))
        .expect("matching returning callback");
    assert_eq!(callback.issued_client_id.as_str(), "oaiapp_expected");
    client.join().expect("callback client");
}

#[test]
fn validates_state_before_code_or_client_semantics() {
    // Given a callback with wrong state and otherwise malformed OAuth fields
    let listener = LoopbackListener::bind().expect("listener");
    let address = listener.local_addr();
    let attempt = dynamic_attempt(&listener);
    let client = send(
        address,
        request(address, "GET", "/auth/callback?state=wrong&client_id=wrong"),
    );

    // When handled, then state is the reported boundary failure
    let error = callback_error(listener.wait_for_callback(&attempt, Duration::from_secs(1)));
    assert_eq!(error, LoopbackError::StateMismatch);
    client.join().expect("callback client");
}

#[test]
fn rejects_missing_or_duplicate_state() {
    for query in [
        "code=code-sentinel&client_id=oaiapp_new",
        "state=first&state=second&code=code-sentinel&client_id=oaiapp_new",
    ] {
        // Given a callback without one unambiguous state value
        let listener = LoopbackListener::bind().expect("listener");
        let address = listener.local_addr();
        let attempt = dynamic_attempt(&listener);
        let target = format!("/auth/callback?{query}");
        let client = send(address, request(address, "GET", &target));

        // When handled, then it is rejected before authorization fields are used
        let error = callback_error(listener.wait_for_callback(&attempt, Duration::from_secs(1)));
        assert!(matches!(
            error,
            LoopbackError::MissingState | LoopbackError::MalformedRequest
        ));
        client.join().expect("callback client");
    }
}

#[test]
fn handles_access_denied_as_cancelled_without_echoing_query() {
    // Given an access_denied callback with matching state
    let listener = LoopbackListener::bind().expect("listener");
    let address = listener.local_addr();
    let attempt = dynamic_attempt(&listener);
    let target = format!(
        "/auth/callback?state={}&error=access_denied&error_description=private-detail",
        attempt.state.expose()
    );
    let client = send(address, request(address, "GET", &target));

    // When handled, then cancellation is sanitized
    let error = callback_error(listener.wait_for_callback(&attempt, Duration::from_secs(1)));
    assert_eq!(error, LoopbackError::Cancelled);
    let response = client.join().expect("callback client");
    assert!(response.contains("ChatGPT connection cancelled"));
    assert!(!response.contains("private-detail"));
}

#[test]
fn rejects_non_get_wrong_path_and_oversize_requests_once() {
    for case in 0..5 {
        // Given a bound one-shot listener and malformed request
        let listener = LoopbackListener::bind().expect("listener");
        let address = listener.local_addr();
        let attempt = dynamic_attempt(&listener);
        let raw_request = match case {
            0 => request(address, "POST", "/auth/callback"),
            1 => request(address, "GET", "/wrong"),
            2 => "malformed\r\n\r\n".to_owned(),
            3 => "G".repeat(8_193),
            _ => format!(
                "GET /auth/callback HTTP/1.1\r\n{}",
                "X".repeat(16_385 - "GET /auth/callback HTTP/1.1\r\n".len())
            ),
        };
        let client = send(address, raw_request);

        // When handled, then the request is rejected and listener terminates
        assert!(listener
            .wait_for_callback(&attempt, Duration::from_secs(1))
            .is_err());
        let response = client.join().expect("callback client");
        assert!(response.contains("ChatGPT connection failed"));
        assert_listener_closed(address);
    }
}

#[test]
fn times_out_without_a_callback() {
    // Given a listener with no client
    let listener = LoopbackListener::bind().expect("listener");
    let address = listener.local_addr();
    let attempt = dynamic_attempt(&listener);

    // When the configured timeout elapses
    let error = callback_error(listener.wait_for_callback(&attempt, Duration::from_millis(20)));

    // Then the listener returns a sanitized timeout
    assert_eq!(error, LoopbackError::Timeout);
    assert_listener_closed(address);
}

#[test]
fn times_out_when_a_client_stalls_mid_header() {
    // Given a connected client that never finishes its headers
    let listener = LoopbackListener::bind().expect("listener");
    let attempt = dynamic_attempt(&listener);
    let (ready_sender, ready_receiver) = std::sync::mpsc::sync_channel(0);
    let (release_sender, release_receiver) = std::sync::mpsc::sync_channel(0);
    let address = listener.local_addr();
    let client = thread::spawn(move || {
        let mut stream = TcpStream::connect(address).expect("callback client must connect");
        stream
            .write_all(b"GET /auth/callback HTTP/1.1\r\n")
            .expect("partial request must write");
        ready_sender.send(()).expect("ready signal");
        release_receiver.recv().expect("release signal");
    });
    ready_receiver.recv().expect("client ready");

    // When the callback deadline elapses during the partial request
    let error = callback_error(listener.wait_for_callback(&attempt, Duration::from_millis(20)));
    release_sender.send(()).expect("release client");
    client.join().expect("callback client");

    // Then the listener reports a bounded timeout
    assert_eq!(error, LoopbackError::Timeout);
}

#[test]
fn accepts_exact_loopback_host_and_bound_port() {
    // Given a callback whose Host header exactly names the bound listener
    let listener = LoopbackListener::bind().expect("listener");
    let address = listener.local_addr();
    let attempt = dynamic_attempt(&listener);
    let target = format!(
        "/auth/callback?code=code-sentinel&state={}&client_id=oaiapp_new",
        attempt.state.expose()
    );
    let client = send(address, request(address, "GET", &target));

    // When the callback is handled
    let callback = listener
        .wait_for_callback(&attempt, Duration::from_secs(1))
        .expect("exact loopback authority must pass");

    // Then authorization succeeds without weakening the issued-client contract
    assert_eq!(callback.issued_client_id.as_str(), "oaiapp_new");
    client.join().expect("callback client");
}

#[test]
fn rejects_missing_malformed_or_non_loopback_host_authority() {
    for case in 0..8 {
        // Given a callback without the listener's single exact Host authority
        let listener = LoopbackListener::bind().expect("listener");
        let address = listener.local_addr();
        let attempt = dynamic_attempt(&listener);
        let port = address.port();
        let wrong_port = if port == u16::MAX { port - 1 } else { port + 1 };
        let host_headers = match case {
            0 => String::new(),
            1 => format!("Host: localhost:{port}\r\n"),
            2 => format!("Host: 127.0.0.2:{port}\r\n"),
            3 => format!("Host: example.test:{port}\r\n"),
            4 => format!("Host: 127.0.0.1:{wrong_port}\r\n"),
            5 => format!("Host 127.0.0.1:{port}\r\n"),
            6 => "Host:\r\n".to_owned(),
            _ => format!("Host: 127.0.0.1:{port}\r\nHost: 127.0.0.1:{port}\r\n"),
        };
        let raw_request = format!(
            "GET /auth/callback?code=code-sentinel&state={}&client_id=oaiapp_new HTTP/1.1\r\n{host_headers}\r\n",
            attempt.state.expose()
        );
        let client = send(address, raw_request);

        // When handled, then the HTTP authority boundary rejects it and closes
        let error = callback_error(listener.wait_for_callback(&attempt, Duration::from_secs(1)));
        assert_eq!(error, LoopbackError::InvalidCallbackHost);
        let response = client.join().expect("callback client");
        assert!(response.contains("ChatGPT connection failed"));
        assert_listener_closed(address);
    }
}
