use std::time::Duration;

use reqwest::{header::HeaderValue, Client, StatusCode, Url};

pub(crate) const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
const OPENAI_MODELS_URL: &str = "https://api.openai.com/v1/models/";
const GEMINI_MODELS_URL: &str = "https://generativelanguage.googleapis.com/v1beta/models/";

pub(crate) const AUTH_ERROR: &str = "API Key를 확인해 주세요.";
pub(crate) const RATE_LIMIT_ERROR: &str = "요청 한도를 확인해 주세요.";
pub(crate) const TIMEOUT_ERROR: &str = "AI 연결 확인 시간이 초과되었습니다.";
pub(crate) const CONNECTION_ERROR: &str = "AI 서비스에 연결하지 못했습니다.";

const OPENAI_MODELS: &[&str] = &["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"];
const GEMINI_MODELS: &[&str] = &[
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash-lite",
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum AiProvider {
    OpenAi,
    Gemini,
}

impl AiProvider {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "openai" => Ok(Self::OpenAi),
            "gemini" => Ok(Self::Gemini),
            _ => Err(CONNECTION_ERROR.to_owned()),
        }
    }

    fn allows(self, model: &str) -> bool {
        match self {
            Self::OpenAi => OPENAI_MODELS.contains(&model),
            Self::Gemini => GEMINI_MODELS.contains(&model),
        }
    }
}

pub(crate) struct ValidatedAiConnection<'a> {
    pub(crate) provider: AiProvider,
    pub(crate) model: &'a str,
    pub(crate) api_key: &'a str,
}

pub(crate) fn validate_input<'a>(
    provider: &str,
    model: &'a str,
    api_key: &'a str,
) -> Result<ValidatedAiConnection<'a>, String> {
    let provider = AiProvider::parse(provider)?;
    let api_key = api_key.trim();
    if api_key.is_empty() {
        return Err(AUTH_ERROR.to_owned());
    }
    if !provider.allows(model) {
        return Err(CONNECTION_ERROR.to_owned());
    }
    Ok(ValidatedAiConnection {
        provider,
        model,
        api_key,
    })
}

pub(crate) fn model_url(base_url: &str, model: &str) -> Result<Url, String> {
    Url::parse(base_url)
        .and_then(|base| base.join(model))
        .map_err(|_| CONNECTION_ERROR.to_owned())
}

pub(crate) fn normalize_status(status: StatusCode) -> Result<(), String> {
    if status.is_success() {
        return Ok(());
    }
    match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => Err(AUTH_ERROR.to_owned()),
        StatusCode::TOO_MANY_REQUESTS => Err(RATE_LIMIT_ERROR.to_owned()),
        _ => Err(CONNECTION_ERROR.to_owned()),
    }
}

async fn request_validation(
    client: &Client,
    connection: &ValidatedAiConnection<'_>,
    openai_models_url: &str,
    gemini_models_url: &str,
) -> Result<(), String> {
    let request = match connection.provider {
        AiProvider::OpenAi => client
            .get(model_url(openai_models_url, connection.model)?)
            .bearer_auth(connection.api_key),
        AiProvider::Gemini => {
            let api_key =
                HeaderValue::from_str(connection.api_key).map_err(|_| AUTH_ERROR.to_owned())?;
            client
                .get(model_url(gemini_models_url, connection.model)?)
                .header("x-goog-api-key", api_key)
        }
    };

    let response = request.send().await.map_err(|error| {
        if error.is_timeout() {
            TIMEOUT_ERROR.to_owned()
        } else {
            CONNECTION_ERROR.to_owned()
        }
    })?;
    normalize_status(response.status())
}

#[tauri::command]
pub async fn validate_ai_connection(
    provider: String,
    model: String,
    api_key: String,
) -> Result<(), String> {
    let connection = validate_input(&provider, &model, &api_key)?;
    let client = Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|_| CONNECTION_ERROR.to_owned())?;
    request_validation(&client, &connection, OPENAI_MODELS_URL, GEMINI_MODELS_URL).await
}

#[cfg(test)]
#[path = "ai_tests.rs"]
mod tests;
