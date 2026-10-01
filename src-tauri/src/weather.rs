use std::time::Duration;

use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::launcher;

const WEATHER_API_ROUTE: &str = "/api/desktop/weather";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "status")]
pub enum WeatherResponse {
    #[serde(rename = "ready")]
    Ready {
        #[serde(rename = "schoolName")]
        school_name: String,
        #[serde(rename = "observedAt")]
        observed_at: String,
        #[serde(rename = "temperatureC")]
        temperature_c: f64,
        #[serde(rename = "apparentTemperatureC")]
        apparent_temperature_c: f64,
        #[serde(rename = "weatherCode")]
        weather_code: i32,
        #[serde(rename = "conditionLabel")]
        condition_label: String,
        #[serde(rename = "highC")]
        high_c: f64,
        #[serde(rename = "lowC")]
        low_c: f64,
    },
    #[serde(rename = "school-missing")]
    SchoolMissing,
    #[serde(rename = "disabled")]
    Disabled {
        #[serde(rename = "schoolName")]
        school_name: String,
    },
    #[serde(rename = "location-unavailable")]
    LocationUnavailable {
        #[serde(rename = "schoolName")]
        school_name: String,
    },
    #[serde(rename = "error")]
    Error { code: String, message: String },
}

fn build_weather_api_url(base_url: Option<&str>) -> Result<Url, String> {
    launcher::build_bogunon_authenticated_api_url(base_url, WEATHER_API_ROUTE)
}

async fn request_weather(
    client: &Client,
    url: Url,
    access_token: &str,
) -> Result<WeatherResponse, String> {
    let response = client
        .get(url)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|_| "날씨 서버에 연결하지 못했습니다.".to_owned())?;
    response
        .json::<WeatherResponse>()
        .await
        .map_err(|_| "날씨 서버 응답을 확인하지 못했습니다.".to_owned())
}

#[tauri::command]
pub async fn fetch_bogunon_weather(
    app: AppHandle,
    access_token: String,
) -> Result<WeatherResponse, String> {
    let base_url = launcher::bogunon_url(&app)?;
    let url = build_weather_api_url(base_url.as_deref())?;
    let client = Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|_| "날씨 요청을 준비하지 못했습니다.".to_owned())?;
    request_weather(&client, url, &access_token).await
}

#[cfg(test)]
#[path = "weather_tests.rs"]
mod tests;
