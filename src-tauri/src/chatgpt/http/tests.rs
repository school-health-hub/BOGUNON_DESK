use super::*;

use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
};

#[test]
fn endpoint_policy_rejects_malicious_discovery_urls() {
    // Given discovery endpoints that could leak OAuth material.
    let malicious = [
        "http://auth.openai.com/api/accounts/oauth/token",
        "https://evil.example/api/accounts/oauth/token",
        "https://auth.openai.com:444/api/accounts/oauth/token",
        "https://user@auth.openai.com/api/accounts/oauth/token",
        "https://auth.openai.com/api/accounts/oauth/token?next=evil",
        "https://auth.openai.com/api/accounts/../oauth/token",
    ];

    // When each URL is checked against the exact token path.
    // Then every URL is rejected without echoing it in the error.
    for value in malicious {
        let error = validate_endpoint(value, EndpointKind::Token)
            .expect_err("malicious endpoint must be rejected");
        assert_eq!(
            error.to_string(),
            "ChatGPT 인증 서버 구성이 올바르지 않습니다."
        );
        assert!(!error.to_string().contains(value));
    }
}

#[test]
fn discovery_contract_accepts_only_openai_source_of_truth() {
    // Given the documented OpenAI discovery metadata.
    let raw = serde_json::json!({
        "issuer": "https://auth.openai.com",
        "authorization_endpoint": "https://auth.openai.com/api/accounts/authorize",
        "token_endpoint": "https://auth.openai.com/api/accounts/oauth/token",
        "jwks_uri": "https://auth.openai.com/.well-known/jwks.json",
        "revocation_endpoint": "https://auth.openai.com/api/accounts/oauth/revoke"
    });

    // When it crosses the discovery boundary.
    let metadata = parse_discovery(&raw).expect("documented metadata is valid");

    // Then every endpoint comes from the validated document.
    assert_eq!(metadata.issuer, "https://auth.openai.com");
    assert_eq!(
        metadata.jwks_uri,
        "https://auth.openai.com/.well-known/jwks.json"
    );
}

#[test]
fn discovery_contract_rejects_wrong_issuer_and_endpoint_path() {
    // Given metadata with a lookalike issuer and an unexpected authorization path.
    let wrong_issuer = serde_json::json!({
        "issuer": "https://auth.openai.com/",
        "authorization_endpoint": "https://auth.openai.com/api/accounts/authorize",
        "token_endpoint": "https://auth.openai.com/api/accounts/oauth/token",
        "jwks_uri": "https://auth.openai.com/.well-known/jwks.json",
        "revocation_endpoint": "https://auth.openai.com/api/accounts/oauth/revoke"
    });
    let wrong_path = serde_json::json!({
        "issuer": "https://auth.openai.com",
        "authorization_endpoint": "https://auth.openai.com/oauth/authorize",
        "token_endpoint": "https://auth.openai.com/api/accounts/oauth/token",
        "jwks_uri": "https://auth.openai.com/.well-known/jwks.json",
        "revocation_endpoint": "https://auth.openai.com/api/accounts/oauth/revoke"
    });

    // When each document is parsed.
    let issuer_error = match parse_discovery(&wrong_issuer) {
        Ok(_) => panic!("issuer must be exact"),
        Err(error) => error,
    };
    let path_error = match parse_discovery(&wrong_path) {
        Ok(_) => panic!("path must be exact"),
        Err(error) => error,
    };

    // Then both fail with the same non-sensitive boundary error.
    assert_eq!(issuer_error, HttpError::InvalidDiscovery);
    assert_eq!(path_error, HttpError::InvalidDiscovery);
}

#[test]
fn reqwest_client_has_twenty_second_timeout() {
    // Given the production client constructor.
    // When its documented timeout is inspected.
    // Then it remains bounded to twenty seconds.
    assert_eq!(REQUEST_TIMEOUT, std::time::Duration::from_secs(20));
    ReqwestTransport::new().expect("TLS HTTP client should build");
}

#[test]
fn reqwest_transport_drives_a_local_wire_fixture() {
    // Given a one-shot local HTTP fixture with a bounded response.
    let listener = TcpListener::bind("127.0.0.1:0").expect("local fixture bind");
    let address = listener.local_addr().expect("local fixture address");
    let server = thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("local fixture request");
        let mut request = [0_u8; 1024];
        let read = stream.read(&mut request).expect("local fixture read");
        assert!(String::from_utf8_lossy(&request[..read]).starts_with("GET /fixture HTTP/1.1"));
        stream
            .write_all(
                b"HTTP/1.1 200 OK\r\nContent-Length: 11\r\nConnection: close\r\n\r\n{\"ok\":true}",
            )
            .expect("local fixture response");
    });

    // When the production transport performs a GET request.
    let transport = ReqwestTransport::new().expect("HTTP client");
    let result = tauri::async_runtime::block_on(transport.send(
        HttpMethod::Get,
        &format!("http://{address}/fixture"),
        &[],
    ))
    .expect("wire response");

    // Then the status and JSON cross the real Reqwest wire boundary.
    assert_eq!(result.status(), 200);
    assert_eq!(
        result.json().expect("JSON response"),
        serde_json::json!({"ok": true})
    );
    server.join().expect("local fixture thread");
}

#[test]
fn reqwest_transport_does_not_follow_redirects() {
    // Given a local redirect pointing at a second local listener.
    let target = TcpListener::bind("127.0.0.1:0").expect("redirect target bind");
    target
        .set_nonblocking(true)
        .expect("redirect target nonblocking");
    let target_address = target.local_addr().expect("redirect target address");
    let source = TcpListener::bind("127.0.0.1:0").expect("redirect source bind");
    let source_address = source.local_addr().expect("redirect source address");
    let server = thread::spawn(move || {
        let (mut stream, _) = source.accept().expect("redirect source request");
        let mut request = [0_u8; 1024];
        stream.read(&mut request).expect("redirect source read");
        let response = format!(
            "HTTP/1.1 302 Found\r\nLocation: http://{target_address}/credential-leak\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
        );
        stream
            .write_all(response.as_bytes())
            .expect("redirect response");
    });

    // When the production transport receives the redirect.
    let transport = ReqwestTransport::new().expect("HTTP client");
    let response = tauri::async_runtime::block_on(transport.send(
        HttpMethod::Get,
        &format!("http://{source_address}/start"),
        &[],
    ))
    .expect("redirect response remains observable");

    // Then it returns the 302 and never contacts the redirect target.
    assert_eq!(response.status(), 302);
    assert_eq!(
        target
            .accept()
            .expect_err("redirect target must stay untouched")
            .kind(),
        std::io::ErrorKind::WouldBlock
    );
    server.join().expect("redirect source thread");
}

#[test]
fn reqwest_transport_rejects_oversized_body_from_wire() {
    // Given a local server declaring a body one byte above the one-MiB cap.
    let listener = TcpListener::bind("127.0.0.1:0").expect("oversize fixture bind");
    let address = listener.local_addr().expect("oversize fixture address");
    let server = thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("oversize fixture request");
        let mut request = [0_u8; 1024];
        stream.read(&mut request).expect("oversize fixture read");
        stream
            .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 1048577\r\nConnection: close\r\n\r\n")
            .expect("oversize response");
    });

    // When the response crosses the production transport boundary.
    let transport = ReqwestTransport::new().expect("HTTP client");
    let error = match tauri::async_runtime::block_on(transport.send(
        HttpMethod::Get,
        &format!("http://{address}/oversize"),
        &[],
    )) {
        Ok(_) => panic!("oversized response must fail"),
        Err(error) => error,
    };

    // Then the typed error is sanitized and the body is not accepted.
    assert_eq!(error, TransportError::ResponseTooLarge);
    assert_eq!(error.to_string(), "ChatGPT 인증 서버에 연결할 수 없습니다.");
    server.join().expect("oversize fixture thread");
}
