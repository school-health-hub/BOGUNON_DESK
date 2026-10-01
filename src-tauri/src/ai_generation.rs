use reqwest::{header::HeaderValue, Client};
use serde::{Deserialize, Serialize};

use crate::ai::{
    normalize_status, validate_input, AiProvider, ValidatedAiConnection, AUTH_ERROR,
    CONNECTION_ERROR, REQUEST_TIMEOUT, TIMEOUT_ERROR,
};

const OPENAI_RESPONSES_URL: &str = "https://api.openai.com/v1/responses";
const GEMINI_GENERATE_URL: &str = "https://generativelanguage.googleapis.com/v1beta/models/";
const MAX_PROMPT_CHARS: usize = 60_000;
const GENERATION_TEMPERATURE: f32 = 0.2;

pub(crate) struct AiEndpoints<'a> {
    pub(crate) openai_responses_url: &'a str,
    pub(crate) gemini_generate_url: &'a str,
}

pub(crate) struct GenerationRequest<'a> {
    pub(crate) connection: &'a ValidatedAiConnection<'a>,
    pub(crate) prompt: &'a str,
}

#[derive(Serialize)]
struct OpenAiRequest<'a> {
    model: &'a str,
    input: &'a str,
    temperature: f32,
}

#[derive(Serialize)]
struct GeminiPart<'a> {
    text: &'a str,
}

#[derive(Serialize)]
struct GeminiContent<'a> {
    parts: [GeminiPart<'a>; 1],
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GeminiGenerationConfig {
    temperature: f32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GeminiRequest<'a> {
    contents: [GeminiContent<'a>; 1],
    generation_config: GeminiGenerationConfig,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    output: Vec<OpenAiOutput>,
}

#[derive(Deserialize)]
struct OpenAiOutput {
    content: Vec<OpenAiContent>,
}

#[derive(Deserialize)]
struct OpenAiContent {
    text: Option<String>,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Vec<GeminiCandidate>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: GeminiResponseContent,
}

#[derive(Deserialize)]
struct GeminiResponseContent {
    parts: Vec<GeminiResponsePart>,
}

#[derive(Deserialize)]
struct GeminiResponsePart {
    text: Option<String>,
}

pub(crate) fn validate_prompt(prompt: &str) -> Result<&str, String> {
    let prompt = prompt.trim();
    if prompt.is_empty() || prompt.chars().count() > MAX_PROMPT_CHARS {
        return Err(CONNECTION_ERROR.to_owned());
    }
    Ok(prompt)
}

pub(crate) fn extract_openai_text(body: &str) -> Result<String, String> {
    let response =
        serde_json::from_str::<OpenAiResponse>(body).map_err(|_| CONNECTION_ERROR.to_owned())?;
    let text = response
        .output
        .into_iter()
        .flat_map(|output| output.content)
        .filter_map(|content| content.text)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_owned();
    if text.is_empty() {
        Err(CONNECTION_ERROR.to_owned())
    } else {
        Ok(text)
    }
}

pub(crate) fn extract_gemini_text(body: &str) -> Result<String, String> {
    let response =
        serde_json::from_str::<GeminiResponse>(body).map_err(|_| CONNECTION_ERROR.to_owned())?;
    let text = response
        .candidates
        .into_iter()
        .flat_map(|candidate| candidate.content.parts)
        .filter_map(|part| part.text)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_owned();
    if text.is_empty() {
        Err(CONNECTION_ERROR.to_owned())
    } else {
        Ok(text)
    }
}

fn map_request_error(error: &reqwest::Error) -> String {
    if error.is_timeout() {
        TIMEOUT_ERROR.to_owned()
    } else {
        CONNECTION_ERROR.to_owned()
    }
}

fn gemini_generation_url(base_url: &str, model: &str) -> Result<String, String> {
    let base_url = base_url.trim_end_matches('/');
    let url = format!("{base_url}/{model}:generateContent");
    reqwest::Url::parse(&url)
        .map(|parsed| parsed.to_string())
        .map_err(|_| CONNECTION_ERROR.to_owned())
}

pub(crate) async fn request_generation(
    client: &Client,
    request: GenerationRequest<'_>,
    endpoints: &AiEndpoints<'_>,
) -> Result<String, String> {
    let prompt = validate_prompt(request.prompt)?;
    let response = match request.connection.provider {
        AiProvider::OpenAi => {
            client
                .post(endpoints.openai_responses_url)
                .bearer_auth(request.connection.api_key)
                .json(&OpenAiRequest {
                    model: request.connection.model,
                    input: prompt,
                    temperature: GENERATION_TEMPERATURE,
                })
                .send()
                .await
        }
        AiProvider::Gemini => {
            let api_key = HeaderValue::from_str(request.connection.api_key)
                .map_err(|_| AUTH_ERROR.to_owned())?;
            let url =
                gemini_generation_url(endpoints.gemini_generate_url, request.connection.model)?;
            client
                .post(url)
                .header("x-goog-api-key", api_key)
                .json(&GeminiRequest {
                    contents: [GeminiContent {
                        parts: [GeminiPart { text: prompt }],
                    }],
                    generation_config: GeminiGenerationConfig {
                        temperature: GENERATION_TEMPERATURE,
                    },
                })
                .send()
                .await
        }
    }
    .map_err(|error| map_request_error(&error))?;
    normalize_status(response.status())?;
    let body = response
        .text()
        .await
        .map_err(|_| CONNECTION_ERROR.to_owned())?;
    match request.connection.provider {
        AiProvider::OpenAi => extract_openai_text(&body),
        AiProvider::Gemini => extract_gemini_text(&body),
    }
}

#[tauri::command]
pub async fn generate_ai_text(
    provider: String,
    model: String,
    api_key: String,
    prompt: String,
) -> Result<String, String> {
    let connection = validate_input(&provider, &model, &api_key)?;
    let client = Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|_| CONNECTION_ERROR.to_owned())?;
    request_generation(
        &client,
        GenerationRequest {
            connection: &connection,
            prompt: &prompt,
        },
        &AiEndpoints {
            openai_responses_url: OPENAI_RESPONSES_URL,
            gemini_generate_url: GEMINI_GENERATE_URL,
        },
    )
    .await
}

#[cfg(test)]
#[path = "ai_generation_tests.rs"]
mod tests;
