use super::{
    request_core,
    wire::{SearchError, SearchRequest, SearchResponse},
};
use std::future::Future;

#[derive(Debug, serde::Serialize)]
pub struct SearchFailure {
    code: SearchError,
    message: &'static str,
}

impl From<SearchError> for SearchFailure {
    fn from(code: SearchError) -> Self {
        Self {
            code,
            message: request_core::safe_message(code),
        }
    }
}

pub(super) async fn run<F, Output>(
    request: &SearchRequest,
    access_token: &str,
    request_id: &str,
    transport: F,
) -> Result<SearchResponse, SearchFailure>
where
    F: FnOnce(request_core::RequestPlan) -> Output,
    Output: Future<Output = Result<SearchResponse, SearchError>>,
{
    let plan = request_core::prepare(request, access_token, request_id)?;
    transport(plan).await.map_err(SearchFailure::from)
}

#[cfg(test)]
pub(super) async fn synthetic<F, Output>(
    request: &SearchRequest,
    access_token: &str,
    request_id: &str,
    transport: F,
) -> Result<SearchResponse, SearchFailure>
where
    F: FnOnce(request_core::RequestPlan) -> Output,
    Output: Future<Output = Result<SearchResponse, SearchError>>,
{
    run(request, access_token, request_id, transport).await
}
