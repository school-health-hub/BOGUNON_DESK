use std::time::Duration;

use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::launcher;

const MEAL_API_ROUTE: &str = "/api/desktop/meal";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "status")]
pub enum MealResponse {
    #[serde(rename = "ready")]
    Ready {
        date: String,
        #[serde(rename = "schoolName")]
        school_name: String,
        menu: Vec<String>,
        calories: Option<String>,
    },
    #[serde(rename = "empty")]
    Empty {
        date: String,
        #[serde(rename = "schoolName")]
        school_name: String,
    },
    #[serde(rename = "disabled")]
    Disabled {
        date: String,
        #[serde(rename = "schoolName")]
        school_name: String,
    },
    #[serde(rename = "school-missing")]
    SchoolMissing { date: String },
    #[serde(rename = "error")]
    Error { code: String, message: String },
}

fn build_meal_api_url(base_url: Option<&str>, date: &str) -> Result<Url, String> {
    let mut url = launcher::build_bogunon_authenticated_api_url(base_url, MEAL_API_ROUTE)?;
    url.query_pairs_mut().append_pair("date", date);
    Ok(url)
}

async fn request_meal(
    client: &Client,
    url: Url,
    access_token: &str,
) -> Result<MealResponse, String> {
    let response = client
        .get(url)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|_| "급식 서버에 연결하지 못했습니다.".to_owned())?;
    response
        .json::<MealResponse>()
        .await
        .map_err(|_| "급식 서버 응답을 확인하지 못했습니다.".to_owned())
}

#[tauri::command]
pub async fn fetch_bogunon_meal(
    app: AppHandle,
    access_token: String,
    date: String,
) -> Result<MealResponse, String> {
    let base_url = launcher::bogunon_url(&app)?;
    let url = build_meal_api_url(base_url.as_deref(), &date)?;
    let client = Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|_| "급식 요청을 준비하지 못했습니다.".to_owned())?;
    request_meal(&client, url, &access_token).await
}

#[cfg(test)]
#[path = "meal_tests.rs"]
mod tests;
