use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
    time::Duration,
};

use reqwest::Client;

use super::{
    normalize_status, request_validation, validate_input, AiProvider, AUTH_ERROR, CONNECTION_ERROR,
    RATE_LIMIT_ERROR, TIMEOUT_ERROR,
};

fn serve_once(
    status: u16,
    body: &'static str,
    delay: Duration,
) -> (String, thread::JoinHandle<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("test server must bind");
    let address = listener.local_addr().expect("test address must exist");
    let handle = thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("test request must connect");
        let mut buffer = [0_u8; 4096];
        let length = stream.read(&mut buffer).expect("request must be readable");
        let request = String::from_utf8_lossy(&buffer[..length]).into_owned();
        thread::sleep(delay);
        let response = format!(
            "HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        let _ = stream.write_all(response.as_bytes());
        request
    });
    (format!("http://{address}/"), handle)
}

#[test]
fn validates_provider_model_and_key_boundaries() {
    let openai = validate_input("openai", "gpt-5.6-luna", "test-key").expect("valid OpenAI input");
    assert_eq!(openai.provider, AiProvider::OpenAi);
    let gemini =
        validate_input("gemini", "gemini-3.8-flash", "test-key").expect("valid Gemini input");
    assert_eq!(gemini.provider, AiProvider::Gemini);

    assert_eq!(
        validate_input("unknown", "gpt-5.6-luna", "test-key")
            .err()
            .as_deref(),
        Some(CONNECTION_ERROR)
    );
    assert_eq!(
        validate_input("openai", "gemini-3.8-flash", "test-key")
            .err()
            .as_deref(),
        Some(CONNECTION_ERROR)
    );
    assert_eq!(
        validate_input("gemini", "arbitrary-model", "test-key")
            .err()
            .as_deref(),
        Some(CONNECTION_ERROR)
    );
    assert_eq!(
        validate_input("openai", "gpt-5.6-luna", "  ")
            .err()
            .as_deref(),
        Some(AUTH_ERROR)
    );
}

#[test]
fn normalizes_provider_status_without_returning_raw_body() {
    assert_eq!(
        normalize_status(reqwest::StatusCode::UNAUTHORIZED),
        Err(AUTH_ERROR.to_owned())
    );
    assert_eq!(
        normalize_status(reqwest::StatusCode::FORBIDDEN),
        Err(AUTH_ERROR.to_owned())
    );
    assert_eq!(
        normalize_status(reqwest::StatusCode::TOO_MANY_REQUESTS),
        Err(RATE_LIMIT_ERROR.to_owned())
    );
    assert_eq!(
        normalize_status(reqwest::StatusCode::INTERNAL_SERVER_ERROR),
        Err(CONNECTION_ERROR.to_owned())
    );
}

#[test]
fn sends_provider_specific_headers_and_fixed_model_paths() {
    let (openai_url, openai_server) = serve_once(200, "{}", Duration::ZERO);
    let openai = validate_input("openai", "gpt-5.6-luna", "fake-openai-key").expect("valid input");
    tauri::async_runtime::block_on(request_validation(
        &Client::new(),
        &openai,
        &openai_url,
        &openai_url,
    ))
    .expect("OpenAI validation");
    let openai_request = openai_server.join().expect("OpenAI server");
    assert!(openai_request.contains("GET /gpt-5.6-luna"));
    assert!(openai_request
        .to_ascii_lowercase()
        .contains("authorization: bearer fake-openai-key"));

    let (gemini_url, gemini_server) = serve_once(200, "{}", Duration::ZERO);
    let gemini =
        validate_input("gemini", "gemini-3.8-flash", "fake-gemini-key").expect("valid input");
    tauri::async_runtime::block_on(request_validation(
        &Client::new(),
        &gemini,
        &gemini_url,
        &gemini_url,
    ))
    .expect("Gemini validation");
    let gemini_request = gemini_server.join().expect("Gemini server");
    assert!(gemini_request.contains("GET /gemini-3.8-flash"));
    assert!(gemini_request
        .to_ascii_lowercase()
        .contains("x-goog-api-key: fake-gemini-key"));
}

#[test]
fn normalizes_auth_rate_limit_and_raw_response_errors() {
    for (status, expected) in [
        (401, AUTH_ERROR),
        (429, RATE_LIMIT_ERROR),
        (500, CONNECTION_ERROR),
    ] {
        let (base_url, server) =
            serve_once(status, r#"{"secret":"provider-detail"}"#, Duration::ZERO);
        let connection =
            validate_input("openai", "gpt-5.6-luna", "fake-secret-key").expect("valid input");
        let error = tauri::async_runtime::block_on(request_validation(
            &Client::new(),
            &connection,
            &base_url,
            &base_url,
        ))
        .expect_err("status must fail");
        server.join().expect("server thread");
        assert_eq!(error, expected);
        assert!(!error.contains("fake-secret-key"));
        assert!(!error.contains("provider-detail"));
    }
}

#[test]
fn normalizes_timeout_without_exposing_key() {
    let (base_url, server) = serve_once(200, "{}", Duration::from_millis(100));
    let client = Client::builder()
        .timeout(Duration::from_millis(10))
        .build()
        .expect("test client");
    let connection =
        validate_input("openai", "gpt-5.6-luna", "fake-timeout-key").expect("valid input");
    let error = tauri::async_runtime::block_on(request_validation(
        &client,
        &connection,
        &base_url,
        &base_url,
    ))
    .expect_err("request must time out");
    server.join().expect("server thread");
    assert_eq!(error, TIMEOUT_ERROR);
    assert!(!error.contains("fake-timeout-key"));
}
