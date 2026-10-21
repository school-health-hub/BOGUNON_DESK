//! Prepared adapter only. Phase 2B IPC never dispatches it.
use super::{
    request_core::{decode, HttpReply, RequestPlan},
    wire::{SearchError, SearchResponse, MAX_RESPONSE_BYTES},
};
pub async fn execute(plan: RequestPlan) -> Result<SearchResponse, SearchError> {
    if !super::request_core::REAL_DISPATCH_ENABLED {
        return Err(SearchError::RealDispatchDisabled);
    }
    // No destination input is accepted here from the webview; RequestPlan is built by prepare().
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(plan.timeout_seconds))
        .build()
        .map_err(|_| SearchError::UpstreamUnavailable)?;
    let mut response = client
        .post(&plan.url)
        .header(reqwest::header::AUTHORIZATION, &plan.authorization)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .body(plan.body)
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                SearchError::Timeout
            } else {
                SearchError::UpstreamUnavailable
            }
        })?;
    let status = response.status().as_u16();
    if (300..400).contains(&status) {
        return Err(SearchError::RedirectBlocked);
    }
    if response
        .content_length()
        .is_some_and(|size| size > MAX_RESPONSE_BYTES as u64)
    {
        return Err(SearchError::ResponseTooLarge);
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| {
        if error.is_timeout() {
            SearchError::Timeout
        } else {
            SearchError::UpstreamUnavailable
        }
    })? {
        if body.len() + chunk.len() > MAX_RESPONSE_BYTES {
            return Err(SearchError::ResponseTooLarge);
        }
        body.extend_from_slice(&chunk);
    }
    decode(HttpReply { status, body })
}
