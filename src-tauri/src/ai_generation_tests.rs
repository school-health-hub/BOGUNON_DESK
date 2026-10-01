use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
    time::Duration,
};

use reqwest::Client;

use super::{
    extract_gemini_text, extract_openai_text, request_generation, validate_prompt, AiEndpoints,
    GenerationRequest,
};
use crate::ai::{validate_input, AUTH_ERROR, CONNECTION_ERROR, RATE_LIMIT_ERROR, TIMEOUT_ERROR};

fn serve_once(
    status: u16,
    body: &'static str,
    delay: Duration,
) -> (String, thread::JoinHandle<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("test server must bind");
    let address = listener.local_addr().expect("test address must exist");
    let handle = thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("test request must connect");
        let mut buffer = [0_u8; 16_384];
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

fn endpoints(base_url: &str) -> AiEndpoints<'_> {
    AiEndpoints {
        openai_responses_url: base_url,
        gemini_generate_url: base_url,
    }
}

#[test]
fn rejects_empty_or_oversized_generation_prompts() {
    assert_eq!(validate_prompt("  "), Err(CONNECTION_ERROR.to_owned()));
    assert_eq!(
        validate_prompt(&"가".repeat(60_001)),
        Err(CONNECTION_ERROR.to_owned())
    );
}

#[test]
fn extracts_only_generated_text_from_provider_responses() {
    let openai = r#"{"output":[{"content":[{"type":"output_text","text":"OpenAI 작성 결과"}]}]}"#;
    let gemini = r#"{"candidates":[{"content":{"parts":[{"text":"Gemini 작성 결과"}]}}]}"#;
    assert_eq!(
        extract_openai_text(openai),
        Ok("OpenAI 작성 결과".to_owned())
    );
    assert_eq!(
        extract_gemini_text(gemini),
        Ok("Gemini 작성 결과".to_owned())
    );
    assert_eq!(
        extract_openai_text(r#"{"raw":"secret"}"#),
        Err(CONNECTION_ERROR.to_owned())
    );
    assert_eq!(
        extract_gemini_text(r#"{"raw":"secret"}"#),
        Err(CONNECTION_ERROR.to_owned())
    );
}

#[test]
fn sends_low_temperature_openai_generation_request() {
    let body = r#"{"output":[{"content":[{"type":"output_text","text":"작성 결과"}]}]}"#;
    let (base_url, server) = serve_once(200, body, Duration::ZERO);
    let connection =
        validate_input("openai", "gpt-5.6-luna", "fake-openai-key").expect("valid input");
    let request = GenerationRequest {
        connection: &connection,
        prompt: "학교 공문 작성",
    };
    let result = tauri::async_runtime::block_on(request_generation(
        &Client::new(),
        request,
        &endpoints(&base_url),
    ))
    .expect("generation response");
    let raw_request = server.join().expect("server thread");
    assert_eq!(result, "작성 결과");
    assert!(raw_request.contains("POST /"));
    assert!(raw_request.contains("\"temperature\":0.2"));
    assert!(raw_request.contains("학교 공문 작성"));
    assert!(raw_request
        .to_ascii_lowercase()
        .contains("authorization: bearer fake-openai-key"));
}

#[test]
fn sends_low_temperature_gemini_generation_request() {
    let body = r#"{"candidates":[{"content":{"parts":[{"text":"정리 결과"}]}}]}"#;
    let (base_url, server) = serve_once(200, body, Duration::ZERO);
    let connection =
        validate_input("gemini", "gemini-3.8-flash", "fake-gemini-key").expect("valid input");
    let request = GenerationRequest {
        connection: &connection,
        prompt: "학교 공문 정리",
    };
    let result = tauri::async_runtime::block_on(request_generation(
        &Client::new(),
        request,
        &endpoints(&base_url),
    ))
    .expect("generation response");
    let raw_request = server.join().expect("server thread");
    assert_eq!(result, "정리 결과");
    assert!(raw_request.contains("POST /gemini-3.8-flash:generateContent"));
    assert!(raw_request.contains("\"temperature\":0.2"));
    assert!(raw_request
        .to_ascii_lowercase()
        .contains("x-goog-api-key: fake-gemini-key"));
}

#[test]
fn normalizes_generation_status_and_hides_raw_values() {
    for (status, expected) in [
        (401, AUTH_ERROR),
        (429, RATE_LIMIT_ERROR),
        (500, CONNECTION_ERROR),
    ] {
        let (base_url, server) = serve_once(status, r#"{"raw":"provider-secret"}"#, Duration::ZERO);
        let connection =
            validate_input("openai", "gpt-5.6-luna", "fake-secret-key").expect("valid input");
        let request = GenerationRequest {
            connection: &connection,
            prompt: "공문 작성",
        };
        let error = tauri::async_runtime::block_on(request_generation(
            &Client::new(),
            request,
            &endpoints(&base_url),
        ))
        .expect_err("status must fail");
        server.join().expect("server thread");
        assert_eq!(error, expected);
        assert!(!error.contains("fake-secret-key"));
        assert!(!error.contains("provider-secret"));
    }
}

#[test]
fn normalizes_generation_timeout_and_network_failure() {
    let (base_url, server) = serve_once(200, "{}", Duration::from_millis(100));
    let client = Client::builder()
        .timeout(Duration::from_millis(10))
        .build()
        .expect("test client");
    let connection =
        validate_input("openai", "gpt-5.6-luna", "fake-timeout-key").expect("valid input");
    let request = GenerationRequest {
        connection: &connection,
        prompt: "공문 작성",
    };
    let timeout =
        tauri::async_runtime::block_on(request_generation(&client, request, &endpoints(&base_url)))
            .expect_err("request must time out");
    server.join().expect("server thread");
    assert_eq!(timeout, TIMEOUT_ERROR);

    let request = GenerationRequest {
        connection: &connection,
        prompt: "공문 작성",
    };
    let network = tauri::async_runtime::block_on(request_generation(
        &Client::new(),
        request,
        &endpoints("http://127.0.0.1:9/"),
    ))
    .expect_err("closed port must fail");
    assert_eq!(network, CONNECTION_ERROR);
}
