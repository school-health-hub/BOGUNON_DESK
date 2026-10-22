use super::*;

#[path = "web_search_parser.rs"]
mod parser;
pub(crate) use parser::{diagnose, WebSearchResult};

use parser::{request_body, supported_model};

pub(crate) async fn search_web<S: ChatGptCredentialStorage, T: PlanTransport>(
    storage: &S,
    transport: &T,
    state: &ChatGptCredentialMutationState,
    now: u64,
    request: &GenerateTextRequest,
) -> Result<WebSearchResult, ChatGptPlanErrorDto> {
    if !supported_model(&request.model)
        || request.prompt.trim().is_empty()
        || request.prompt.len() > 32_000
    {
        return Err(InternalError::bare(InternalErrorKind::Permission).dto());
    }
    let token = valid_access_token(storage, transport, state, now)
        .await
        .map_err(|error| error.dto())?;
    let response = transport
        .send(ApiRequest {
            method: ApiMethod::Post,
            url: RESPONSES_URL.to_owned(),
            bearer: Some(token.expose().to_owned()),
            body: RequestBody::Json(request_body(&request.model, &request.prompt)),
        })
        .await
        .map_err(|error| error.dto())?;
    if let Err(error) = ensure_success(&response) {
        if error.kind == InternalErrorKind::Reauth {
            invalidate_if_current(storage, state, &token)
                .await
                .map_err(|error| error.dto())?;
        }
        return Err(error.dto());
    }
    parse_response_stream(&response.body).map_err(|error| error.dto())?;
    let checked_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| ChatGptPlanErrorDto::clock())?
        .as_secs();
    parser::parse(&response.body, checked_at).map_err(|_| InternalError::INVALID_RESPONSE.dto())
}
