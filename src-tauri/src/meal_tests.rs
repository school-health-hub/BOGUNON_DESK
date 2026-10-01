use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
};

use reqwest::Client;

use super::{build_meal_api_url, request_meal, MealResponse};

#[test]
fn requires_configured_bogunon_url() {
    assert_eq!(
        build_meal_api_url(None, "2026-09-21").expect_err("missing URL must fail"),
        "BOGUNON 연결이 필요합니다."
    );
}

#[test]
fn builds_fixed_meal_route_and_encoded_date_query() {
    let url = build_meal_api_url(Some("https://bogunon.vercel.app/settings"), "2026-09-21")
        .expect("valid configured URL");

    assert_eq!(
        url.as_str(),
        "https://bogunon.vercel.app/api/desktop/meal?date=2026-09-21"
    );
}

#[test]
fn rejects_untrusted_or_insecure_bogunon_api_origins() {
    for input in [
        "https://attacker.example/settings",
        "http://bogunon.vercel.app/settings",
        "not a URL",
    ] {
        assert!(build_meal_api_url(Some(input), "2026-09-21").is_err());
    }
}

fn serve_once(body: &'static str) -> (String, thread::JoinHandle<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("test server must bind");
    let address = listener.local_addr().expect("test address must exist");
    let handle = thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("test request must connect");
        let mut buffer = [0_u8; 4096];
        let length = stream
            .read(&mut buffer)
            .expect("test request must be readable");
        let request = String::from_utf8_lossy(&buffer[..length]).into_owned();
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
        );
        stream
            .write_all(response.as_bytes())
            .expect("test response must be writable");
        request
    });
    (format!("http://{address}"), handle)
}

#[test]
fn sends_bearer_header_and_parses_ready_response() {
    let (base_url, server) = serve_once(
        r#"{"status":"ready","date":"2026-09-21","schoolName":"테스트고","menu":["밥","국"],"calories":"700 kcal"}"#,
    );
    let url = reqwest::Url::parse(&format!("{base_url}/api/desktop/meal?date=2026-09-21"))
        .expect("test URL");
    let response =
        tauri::async_runtime::block_on(request_meal(&Client::new(), url, "secret-access-token"))
            .expect("ready response");
    let request = server.join().expect("test server thread");

    assert!(request.contains("authorization: Bearer secret-access-token"));
    assert!(request.contains("GET /api/desktop/meal?date=2026-09-21"));
    assert_eq!(
        response,
        MealResponse::Ready {
            date: "2026-09-21".to_owned(),
            school_name: "테스트고".to_owned(),
            menu: vec!["밥".to_owned(), "국".to_owned()],
            calories: Some("700 kcal".to_owned()),
        }
    );
}

#[test]
fn parses_all_safe_server_statuses() {
    let fixtures = [
        r#"{"status":"empty","date":"2026-09-21","schoolName":"테스트고"}"#,
        r#"{"status":"disabled","date":"2026-09-21","schoolName":"테스트고"}"#,
        r#"{"status":"school-missing","date":"2026-09-21"}"#,
        r#"{"status":"error","code":"MEAL_UPSTREAM_ERROR","message":"급식 정보를 불러오지 못했습니다."}"#,
    ];

    for fixture in fixtures {
        let (base_url, server) = serve_once(fixture);
        let url = reqwest::Url::parse(&format!("{base_url}/api/desktop/meal?date=2026-09-21"))
            .expect("test URL");
        let result = tauri::async_runtime::block_on(request_meal(&Client::new(), url, "token"));
        assert!(result.is_ok());
        server.join().expect("test server thread");
    }
}

#[test]
fn maps_network_failure_without_exposing_token() {
    let url = reqwest::Url::parse("http://127.0.0.1:9/api/desktop/meal?date=2026-09-21")
        .expect("valid local URL");
    let error =
        tauri::async_runtime::block_on(request_meal(&Client::new(), url, "secret-access-token"))
            .expect_err("closed port must fail");

    assert_eq!(error, "급식 서버에 연결하지 못했습니다.");
    assert!(!error.contains("secret-access-token"));
}
