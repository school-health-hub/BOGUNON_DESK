use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
};

use reqwest::Client;

use super::{build_weather_api_url, request_weather, WeatherResponse};

#[test]
fn requires_configured_bogunon_url() {
    assert_eq!(
        build_weather_api_url(None).expect_err("missing URL must fail"),
        "BOGUNON 연결이 필요합니다."
    );
}

#[test]
fn builds_fixed_weather_route_from_configured_host() {
    let url = build_weather_api_url(Some("https://bogunon.vercel.app/settings"))
        .expect("valid configured URL");
    assert_eq!(
        url.as_str(),
        "https://bogunon.vercel.app/api/desktop/weather"
    );
}

#[test]
fn rejects_untrusted_or_insecure_bogunon_api_origins() {
    for input in [
        "https://attacker.example/settings",
        "http://bogunon.vercel.app/settings",
        "not a URL",
    ] {
        assert!(build_weather_api_url(Some(input)).is_err());
    }
}

fn serve_once(body: &'static str) -> (String, thread::JoinHandle<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("test server must bind");
    let address = listener.local_addr().expect("test address must exist");
    let handle = thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("test request must connect");
        let mut buffer = [0_u8; 4096];
        let length = stream.read(&mut buffer).expect("request must be readable");
        let request = String::from_utf8_lossy(&buffer[..length]).into_owned();
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(), body
        );
        stream
            .write_all(response.as_bytes())
            .expect("response must be writable");
        request
    });
    (format!("http://{address}"), handle)
}

#[test]
fn sends_bearer_header_and_parses_ready_response() {
    let (base_url, server) = serve_once(
        r#"{"status":"ready","schoolName":"테스트고","observedAt":"2026-09-21T09:00:00+09:00","temperatureC":24.2,"apparentTemperatureC":24.0,"weatherCode":1,"conditionLabel":"대체로 맑음","highC":27.0,"lowC":18.0}"#,
    );
    let url = reqwest::Url::parse(&format!("{base_url}/api/desktop/weather")).expect("test URL");
    let response =
        tauri::async_runtime::block_on(request_weather(&Client::new(), url, "secret-access-token"))
            .expect("ready response");
    let request = server.join().expect("server thread");
    assert!(request.contains("authorization: Bearer secret-access-token"));
    assert!(request.contains("GET /api/desktop/weather"));
    assert!(matches!(
        response,
        WeatherResponse::Ready {
            weather_code: 1,
            ..
        }
    ));
}

#[test]
fn parses_all_safe_server_statuses() {
    let fixtures = [
        r#"{"status":"school-missing"}"#,
        r#"{"status":"disabled","schoolName":"테스트고"}"#,
        r#"{"status":"location-unavailable","schoolName":"테스트고"}"#,
        r#"{"status":"error","code":"WEATHER_UPSTREAM_ERROR","message":"날씨 정보를 불러오지 못했습니다."}"#,
    ];
    for fixture in fixtures {
        let (base_url, server) = serve_once(fixture);
        let url =
            reqwest::Url::parse(&format!("{base_url}/api/desktop/weather")).expect("test URL");
        assert!(
            tauri::async_runtime::block_on(request_weather(&Client::new(), url, "token")).is_ok()
        );
        server.join().expect("server thread");
    }
}

#[test]
fn maps_network_failure_without_exposing_token() {
    let url =
        reqwest::Url::parse("http://127.0.0.1:9/api/desktop/weather").expect("valid local URL");
    let error =
        tauri::async_runtime::block_on(request_weather(&Client::new(), url, "secret-access-token"))
            .expect_err("closed port must fail");
    assert_eq!(error, "날씨 서버에 연결하지 못했습니다.");
    assert!(!error.contains("secret-access-token"));
}
